"""
LocalStore Backend - Production Flask Application
"""
from pathlib import Path
from flask import Flask, jsonify, request, Response, send_from_directory, g
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import json
import os
import time
import shutil
import secrets
import subprocess
import datetime
import venv
import httpx
import logging
from functools import wraps
from threading import Lock
import sys

# Configure logging before any imports
from pythonjsonlogger import jsonlogger

# Setup structured logging
log_level = logging.DEBUG if os.getenv('FLASK_DEBUG', '0') == '1' else logging.INFO
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)
logger = logging.getLogger('localstore')
logger.addHandler(logHandler)
logger.setLevel(log_level)

# Prevent double logging in Flask
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

os.environ.setdefault("FLASK_SKIP_DOTENV", "1")
from state_json import AtomicJSONState
from install import ensure_tool_installed
from proc import ProcManager, venv_python
from security import RateLimiter, SecurityHeaders
from schemas import validate_tool_install, validate_tool_create

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
DATA = BACKEND / "data"; DATA.mkdir(exist_ok=True)
TOOLS_DIR = ROOT / "tools"; TOOLS_DIR.mkdir(exist_ok=True)
REGISTRY_PATH = BACKEND / "registry.json"
STATE_PATH = DATA / "install_state.json"

# Initialize Flask app
app = Flask(__name__, static_folder=str(BACKEND / 'static'), static_url_path='')

# Security configuration
app.config.update(
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max request size
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=datetime.timedelta(hours=24)
)

# CORS configuration - restrictive in production
if os.getenv('FLASK_ENV') == 'production':
    CORS(app, origins=['http://localhost:8000', 'http://127.0.0.1:8000'])
else:
    CORS(app, origins="*")

# Initialize components
state = AtomicJSONState(STATE_PATH)
runtime = ProcManager()
rate_limiter = RateLimiter()
security_headers = SecurityHeaders()

# Import and register dev blueprint
from dev_api import dev_bp
dev_bp.state = state
dev_bp.runtime = runtime
app.register_blueprint(dev_bp)

# Request ID middleware
@app.before_request
def before_request():
    g.request_id = request.headers.get('X-Request-ID', secrets.token_hex(16))
    g.start_time = time.time()
    
    # Log request
    logger.info("request_started", extra={
        "request_id": g.request_id,
        "method": request.method,
        "path": request.path,
        "remote_addr": request.remote_addr
    })

@app.after_request
def after_request(response):
    # Add security headers
    response = security_headers.apply(response)
    
    # Log response
    duration = time.time() - g.get('start_time', time.time())
    logger.info("request_completed", extra={
        "request_id": g.get('request_id'),
        "status_code": response.status_code,
        "duration_ms": round(duration * 1000, 2)
    })
    
    return response

# Rate limiting decorator
def rate_limit(max_requests=60, window=60):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not rate_limiter.check_rate_limit(request.remote_addr, max_requests, window):
                return jsonify({"error": "Rate limit exceeded"}), 429
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# API Routes
@app.get("/api/health")
def health():
    """Health check endpoint"""
    return jsonify({
        "ok": True,
        "version": "1.0.0",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "environment": os.getenv('FLASK_ENV', 'development')
    })

@app.get("/api/registry")
def get_registry():
    """Get available tools from registry"""
    try:
        if not REGISTRY_PATH.exists():
            return jsonify([])
        registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        return jsonify(registry)
    except Exception as e:
        logger.error("registry_read_error", exc_info=True)
        return jsonify({"error": "Failed to read registry"}), 500

@app.get("/api/tools")
def list_tools():
    """List installed tools with runtime status"""
    try:
        out = []
        for t in state.list_installed():
            # Reconcile runtime truth
            if runtime.is_running(t["id"]):
                t["status"] = "running"
                t["port"] = runtime.get_port(t["id"]) or t.get("port")
            else:
                t["status"] = "stopped"
                t["port"] = None
                # Check if died unexpectedly
                pi = runtime.procs.get(t["id"])
                if pi and pi.popen.poll() is not None:
                    runtime.procs.pop(t["id"], None)
            out.append(t)
        state.save()
        return jsonify(out)
    except Exception as e:
        logger.error("list_tools_error", exc_info=True)
        return jsonify({"error": "Failed to list tools"}), 500

@app.post("/api/tools/install")
@rate_limit(max_requests=10, window=60)
def install_tool():
    """Install a tool from registry"""
    try:
        data = request.json or {}
        
        # Validate input
        validation_error = validate_tool_install(data)
        if validation_error:
            return jsonify({"error": validation_error}), 400
        
        tool_id = data.get("id")
        
        # Check registry
        reg = {i["id"]: i for i in json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))}
        meta = reg.get(tool_id)
        if not meta:
            return jsonify({"error": "Tool not found in registry"}), 404
        
        # Install tool (transactional)
        logger.info("installing_tool", extra={"tool_id": tool_id})
        info = ensure_tool_installed(tool_id, meta, TOOLS_DIR)
        state.upsert(info)
        
        logger.info("tool_installed", extra={"tool_id": tool_id})
        return jsonify(info)
        
    except Exception as e:
        logger.error("install_error", exc_info=True, extra={"tool_id": data.get("id")})
        return jsonify({"error": str(e)}), 500

@app.post("/api/tools/<tool_id>/start")
@rate_limit(max_requests=30, window=60)
def start_tool(tool_id: str):
    """Start a tool"""
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    
    if runtime.is_running(tool_id):
        return jsonify({
            "id": tool_id,
            "status": "running",
            "port": runtime.get_port(tool_id)
        })
    
    try:
        logger.info("starting_tool", extra={"tool_id": tool_id})
        port = runtime.start_uvicorn(tool_id, Path(t['venv']), Path(t['path']), t['entry'])
        t['status'] = 'running'
        t['port'] = port
        state.upsert(t)
        
        logger.info("tool_started", extra={"tool_id": tool_id, "port": port})
        return jsonify({
            "id": tool_id,
            "status": "running",
            "port": port
        })
    except Exception as e:
        logger.error("start_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": str(e)}), 500

@app.post("/api/tools/<tool_id>/stop")
@rate_limit(max_requests=30, window=60)
def stop_tool(tool_id: str):
    """Stop a tool"""
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    
    try:
        logger.info("stopping_tool", extra={"tool_id": tool_id})
        runtime.stop(tool_id)
        t['status'] = 'stopped'
        t['port'] = None
        state.upsert(t)
        
        logger.info("tool_stopped", extra={"tool_id": tool_id})
        return jsonify({
            "id": tool_id,
            "status": "stopped",
            "port": None
        })
    except Exception as e:
        logger.error("stop_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": str(e)}), 500

@app.delete("/api/tools/<tool_id>")
@rate_limit(max_requests=10, window=60)
def delete_tool(tool_id: str):
    """Delete a tool"""
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    
    try:
        logger.info("deleting_tool", extra={"tool_id": tool_id})
        
        # Stop if running
        if runtime.is_running(tool_id):
            runtime.stop(tool_id)
        
        # Remove from filesystem
        tool_path = Path(t['path'])
        if tool_path.exists():
            shutil.rmtree(tool_path)
        
        # Remove from state
        state.remove(tool_id)
        
        logger.info("tool_deleted", extra={"tool_id": tool_id})
        return jsonify({"ok": True})
        
    except Exception as e:
        logger.error("delete_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": str(e)}), 500

# File system helpers for installed tools
def _tool_root(tool_id: str) -> Path:
    t = state.get(tool_id)
    if not t:
        raise FileNotFoundError("Tool not found")
    return Path(t['path']).resolve()

def _safe_join(root: Path, rel: str) -> Path:
    p = (root / rel).resolve()
    if not str(p).startswith(str(root)):
        raise ValueError('Path traversal detected')
    return p

@app.get('/api/tools/<tool_id>/files')
def list_tool_files(tool_id: str):
    """List files in tool directory"""
    try:
        root = _tool_root(tool_id)
        if not root.exists():
            return jsonify({"error": "Tool path not found"}), 404
            
        def build_tree(path: Path) -> dict:
            node = {'type': 'dir', 'name': path.name, 'children': []}
            try:
                for p in sorted(path.iterdir()):
                    name = p.name
                    # Skip hidden and system files
                    if name.startswith('.') or name in {'__pycache__', 'venv', '.venv'}:
                        continue
                    if p.is_dir():
                        node['children'].append(build_tree(p))
                    else:
                        node['children'].append({
                            'type': 'file',
                            'name': name,
                            'path': str(p.relative_to(root)),
                            'size': p.stat().st_size
                        })
            except PermissionError:
                pass
            return node
            
        return jsonify(build_tree(root))
    except FileNotFoundError:
        return jsonify({"error": "Tool not found"}), 404
    except Exception as e:
        logger.error("list_files_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": "Failed to list files"}), 500

@app.get('/api/tools/<tool_id>/file')
def read_tool_file(tool_id: str):
    """Read a file from tool directory"""
    try:
        rel = request.args.get('path', '')
        if not rel:
            return jsonify({"error": "Missing path parameter"}), 400
            
        root = _tool_root(tool_id)
        target = _safe_join(root, rel)
        
        if not target.exists():
            return jsonify({"error": "File not found"}), 404
            
        # Check file size
        if target.stat().st_size > 1024 * 1024:  # 1MB limit
            return jsonify({"error": "File too large"}), 413
            
        try:
            content = target.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            content = target.read_text(errors='replace')
            
        return jsonify({
            "path": rel,
            "content": content
        })
    except FileNotFoundError:
        return jsonify({"error": "Tool not found"}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error("read_file_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": "Failed to read file"}), 500

@app.post('/api/tools/<tool_id>/file')
@rate_limit(max_requests=30, window=60)
def write_tool_file(tool_id: str):
    """Write a file to tool directory"""
    try:
        data = request.json or {}
        rel = data.get('path')
        content = data.get('content', '')
        
        if not rel:
            return jsonify({"error": "Missing path"}), 400
            
        root = _tool_root(tool_id)
        target = _safe_join(root, rel)
        
        # Create parent directories
        target.parent.mkdir(parents=True, exist_ok=True)
        
        # Write file
        target.write_text(content, encoding='utf-8')
        
        logger.info("file_written", extra={
            "tool_id": tool_id,
            "file": rel,
            "size": len(content)
        })
        
        return jsonify({"ok": True})
    except FileNotFoundError:
        return jsonify({"error": "Tool not found"}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error("write_file_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": "Failed to write file"}), 500

@app.post('/api/tools/<tool_id>/restart')
@rate_limit(max_requests=20, window=60)
def restart_tool(tool_id: str):
    """Restart a tool"""
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
        
    try:
        logger.info("restarting_tool", extra={"tool_id": tool_id})
        
        # Stop if running
        if runtime.is_running(tool_id):
            runtime.stop(tool_id)
            
        # Start again
        port = runtime.start_uvicorn(tool_id, Path(t['venv']), Path(t['path']), t['entry'])
        t['status'] = 'running'
        t['port'] = port
        state.upsert(t)
        
        logger.info("tool_restarted", extra={"tool_id": tool_id, "port": port})
        return jsonify({
            "id": tool_id,
            "status": "running",
            "port": port
        })
    except Exception as e:
        logger.error("restart_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": str(e)}), 500

@app.post('/api/tools/<tool_id>/exec')
@rate_limit(max_requests=10, window=60)
def exec_in_tool(tool_id: str):
    """Execute command in tool environment"""
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
        
    data = request.json or {}
    command = data.get('command')
    python = data.get('python', False)
    
    if not command:
        return jsonify({"error": "Missing command"}), 400
        
    # Security: limit command length
    if len(command) > 1000:
        return jsonify({"error": "Command too long"}), 400
        
    cwd = Path(t['path'])
    vpy = venv_python(Path(t['venv']))
    
    try:
        if python:
            proc = subprocess.run(
                [str(vpy), '-c', command],
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
        else:
            # Restricted shell execution
            proc = subprocess.run(
                command,
                cwd=str(cwd),
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                env={**os.environ, "PATH": f"{vpy.parent}:{os.environ.get('PATH', '')}"}
            )
            
        return jsonify({
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr
        })
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Command timed out"}), 408
    except Exception as e:
        logger.error("exec_error", exc_info=True, extra={"tool_id": tool_id})
        return jsonify({"error": str(e)}), 500

# Tool creation endpoints
@app.post("/api/tools/create/folder")
@rate_limit(max_requests=5, window=60)
def create_folder():
    """Create tool from local folder"""
    data = request.json
    
    # Validate input
    validation_error = validate_tool_create(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400
        
    if state.get(data['id']):
        return jsonify({"error": "Tool ID already exists"}), 400
        
    dest = TOOLS_DIR / data['id']
    try:
        source_path = Path(data['path'])
        if not source_path.exists():
            return jsonify({"error": "Source path does not exist"}), 400
            
        shutil.copytree(str(source_path), str(dest))
        info = ensure_tool_installed(data['id'], data, TOOLS_DIR)
        state.upsert(info)
        
        logger.info("tool_created_from_folder", extra={"tool_id": data['id']})
        return jsonify(info)
    except Exception as e:
        logger.error("create_folder_error", exc_info=True)
        if dest.exists():
            shutil.rmtree(dest)
        return jsonify({"error": str(e)}), 500

@app.post("/api/tools/create/git")
@rate_limit(max_requests=5, window=60)
def create_git():
    """Create tool from git repository"""
    data = request.json
    
    # Validate input
    validation_error = validate_tool_create(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400
        
    if state.get(data['id']):
        return jsonify({"error": "Tool ID already exists"}), 400
        
    dest = TOOLS_DIR / data['id']
    try:
        from git import Repo
        logger.info("cloning_repository", extra={
            "tool_id": data['id'],
            "repo": data['repo']
        })
        
        Repo.clone_from(
            data['repo'],
            dest,
            branch=data.get('ref', 'main'),
            depth=1
        )
        
        if data.get('subdir'):
            # Move subdir contents to root
            subdir_path = dest / data['subdir']
            if subdir_path.exists():
                temp_dir = dest.parent / f"{data['id']}_temp"
                shutil.move(str(subdir_path), str(temp_dir))
                shutil.rmtree(dest)
                shutil.move(str(temp_dir), str(dest))
                
        info = ensure_tool_installed(data['id'], data, TOOLS_DIR)
        state.upsert(info)
        
        logger.info("tool_created_from_git", extra={"tool_id": data['id']})
        return jsonify(info)
    except Exception as e:
        logger.error("create_git_error", exc_info=True)
        if dest.exists():
            shutil.rmtree(dest)
        return jsonify({"error": str(e)}), 500

@app.post("/api/tools/create/pip")
@rate_limit(max_requests=5, window=60)
def create_pip():
    """Create tool from pip package"""
    data = request.json
    
    # Validate input
    validation_error = validate_tool_create(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400
        
    if state.get(data['id']):
        return jsonify({"error": "Tool ID already exists"}), 400
        
    dest = TOOLS_DIR / data['id']
    try:
        dest.mkdir(parents=True, exist_ok=True)
        venv_dir = dest / '.venv'
        venv.create(venv_dir, with_pip=True)
        
        pip_path = venv_python(venv_dir).parent / ('pip.exe' if os.name == 'nt' else 'pip')
        
        logger.info("installing_pip_package", extra={
            "tool_id": data['id'],
            "spec": data['spec']
        })
        
        subprocess.check_call(
            [str(pip_path), 'install'] + data['spec'].split(),
            timeout=300  # 5 minute timeout
        )
        
        # Create a minimal app.py if entry point specified
        if data.get('entry'):
            app_py = dest / 'app.py'
            module, attr = data['entry'].split(':')
            app_py.write_text(f"""# Auto-generated app wrapper
from {module} import {attr}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
""")
        
        info = {
            'id': data['id'],
            'name': data['name'],
            'entry': data.get('entry', 'app:app'),
            'path': str(dest),
            'venv': str(venv_dir),
            'status': 'stopped',
            'port': None
        }
        state.upsert(info)
        
        logger.info("tool_created_from_pip", extra={"tool_id": data['id']})
        return jsonify(info)
    except Exception as e:
        logger.error("create_pip_error", exc_info=True)
        if dest.exists():
            shutil.rmtree(dest)
        return jsonify({"error": str(e)}), 500

# Runtime management
@app.get("/api/runtimes")
def list_runtimes():
    """List available Python runtimes"""
    runtimes = []
    import shutil
    
    # Add current python
    runtimes.append({
        "version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "path": sys.executable,
        "type": "python",
        "default": True,
        "managed": False
    })
    
    # Try to find other pythons
    for py_name in ['python3', 'python3.8', 'python3.9', 'python3.10', 'python3.11', 'python3.12', 'python3.13']:
        py_path = shutil.which(py_name)
        if py_path and py_path != sys.executable:
            try:
                result = subprocess.run(
                    [py_path, '--version'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                version = result.stdout.strip().split()[-1]
                runtimes.append({
                    "version": version,
                    "path": py_path,
                    "type": "python",
                    "default": False,
                    "managed": False
                })
            except Exception:
                pass
    
    # Remove duplicates
    seen = set()
    unique_runtimes = []
    for rt in runtimes:
        key = (rt['path'], rt['version'])
        if key not in seen:
            seen.add(key)
            unique_runtimes.append(rt)
    
    return jsonify(unique_runtimes)

@app.patch("/api/tools/<tool_id>")
@rate_limit(max_requests=30, window=60)
def update_tool(tool_id):
    """Update tool settings"""
    data = request.json
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    
    # Only allow specific fields to be updated
    allowed_fields = ['autostart', 'python', 'name', 'description', 'tags']
    
    for field in allowed_fields:
        if field in data:
            t[field] = data[field]
            
    state.upsert(t)
    logger.info("tool_updated", extra={"tool_id": tool_id, "fields": list(data.keys())})
    
    return jsonify({"ok": True})

# API key authentication
API_KEY = os.getenv('LOCALSTORE_API_KEY')

@app.before_request
def check_auth():
    """Check API key authentication if configured"""
    if not API_KEY:
        return
        
    # Allow non-API routes without auth
    if not request.path.startswith("/api/"):
        return
        
    # Check header
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {API_KEY}":
        logger.warning("auth_failed", extra={
            "remote_addr": request.remote_addr,
            "path": request.path
        })
        return jsonify({"error": "Unauthorized"}), 401

# SSE logs endpoint
@app.get("/api/tools/<tool_id>/logs")
def logs(tool_id: str):
    """Stream live logs from running tool"""
    pi = runtime.procs.get(tool_id)
    if not pi:
        return jsonify({"error": "Tool not running"}), 404

    def generate():
        yield "retry: 1500\n\n"
        f = pi.popen.stdout
        
        while True:
            if pi.popen.poll() is not None:
                yield f'data: {{"event":"exit","code":{pi.popen.returncode}}}\n\n'
                break
                
            line = f.readline()
            if not line:
                time.sleep(0.1)
                continue
                
            try:
                txt = line.decode("utf-8", errors="ignore").rstrip("\n")
                yield f'data: {{"event":"log","line":{json.dumps(txt)}}}\n\n'
            except Exception as e:
                logger.error("log_stream_error", exc_info=True)

    return Response(generate(), mimetype="text/event-stream")

# Reverse proxy for running tools
ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]

def _running_port_from_state_or_runtime(actual_id: str):
    """Get port for running tool"""
    if runtime.is_running(actual_id):
        p = runtime.get_port(actual_id)
        if p:
            return p
    t = state.get(actual_id)
    if t and t.get("port"):
        return t["port"]
    return None

def _filtered_request_headers(headers):
    """Filter hop-by-hop headers"""
    hop_by_hop = {
        "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailers", "transfer-encoding", "upgrade", "host"
    }
    return {k: v for k, v in headers.items() if k.lower() not in hop_by_hop}

@app.route("/api/apps/<tool_id>", defaults={"subpath": ""}, methods=ALLOWED_METHODS, strict_slashes=False)
@app.route("/api/apps/<tool_id>/<path:subpath>", methods=ALLOWED_METHODS)
def proxy(tool_id: str, subpath: str):
    """Reverse proxy to running tools"""
    is_dev = tool_id.startswith("dev-")
    actual_id = tool_id[4:] if is_dev else tool_id

    port = _running_port_from_state_or_runtime(actual_id)
    if not port:
        return jsonify({"error": "Tool not running"}), 404

    # Build target URL
    tail = subpath.lstrip("/")
    qs = request.query_string.decode("utf-8")
    target_url = f"http://127.0.0.1:{port}/" + (tail if tail else "")
    if qs:
        target_url += ("?" + qs)

    req_method = request.method
    req_headers = _filtered_request_headers(request.headers)
    req_body = request.get_data() if req_method in ("POST", "PUT", "PATCH") else None

    try:
        # Make proxied request
        r = httpx.request(
            req_method,
            target_url,
            headers=req_headers,
            content=req_body,
            follow_redirects=True,
            timeout=30.0
        )
        
        # Filter response headers
        blocked = {"connection", "transfer-encoding", "content-encoding", "server"}
        resp_headers = [(k, v) for k, v in r.headers.items() if k.lower() not in blocked]
        
        return Response(r.content, status=r.status_code, headers=resp_headers)
    except httpx.TimeoutError:
        return jsonify({"error": "Tool request timed out"}), 504
    except httpx.RequestError as e:
        logger.error("proxy_error", exc_info=True, extra={"tool_id": actual_id})
        return jsonify({"error": f"Proxy error: {e}"}), 502

# Serve SPA - these must be AFTER all API routes
@app.get('/')
def spa_index():
    """Serve SPA index"""
    return send_from_directory(app.static_folder, 'index.html')

@app.get('/<path:path>')
def spa_catchall(path):
    """Serve SPA assets or fallback to index"""
    # Don't handle API routes
    if path.startswith('api/'):
        return jsonify({'error': 'Not Found'}), 404
    
    # Check if file exists
    file_path = Path(app.static_folder) / path
    if file_path.exists() and file_path.is_file():
        return send_from_directory(app.static_folder, path)
    
    # Fallback to SPA for client-side routing
    return send_from_directory(app.static_folder, 'index.html')

# Global error handler
@app.errorhandler(Exception)
def handle_error(e):
    """Handle all errors consistently"""
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    
    logger.error("unhandled_error", exc_info=True)
    
    # Don't expose internal errors in production
    if os.getenv('FLASK_ENV') == 'production':
        return jsonify({"error": "Internal server error"}), 500
    else:
        return jsonify({"error": str(e)}), 500

# Startup tasks
def startup_tasks():
    """Run startup tasks"""
    logger.info("startup_begin", extra={
        "version": "1.0.0",
        "environment": os.getenv('FLASK_ENV', 'development'),
        "python_version": sys.version
    })
    
    # Start autostart tools
    for t in state.list_installed():
        if t.get('autostart'):
            try:
                logger.info("autostarting_tool", extra={"tool_id": t['id']})
                runtime.start_uvicorn(t['id'], Path(t['venv']), Path(t['path']), t['entry'])
            except Exception as e:
                logger.error("autostart_failed", exc_info=True, extra={"tool_id": t['id']})
    
    logger.info("startup_complete")

# Shutdown handler
def shutdown_handler():
    """Clean shutdown of all tools"""
    logger.info("shutdown_begin")
    
    # Stop all running tools
    for tool_id in list(runtime.procs.keys()):
        try:
            runtime.stop(tool_id)
            logger.info("tool_stopped_on_shutdown", extra={"tool_id": tool_id})
        except Exception:
            pass
    
    logger.info("shutdown_complete")

# Register shutdown handler
import atexit
atexit.register(shutdown_handler)

if __name__ == "__main__":
    # Run startup tasks
    startup_tasks()
    
    # Get configuration
    debug_mode = os.getenv('FLASK_DEBUG', '1') == '1'
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_PORT', '8000'))
    
    logger.info("server_starting", extra={
        "host": host,
        "port": port,
        "debug": debug_mode
    })
    
    # Run Flask app
    app.run(
        host=host,
        port=port,
        debug=debug_mode,
        use_reloader=False,  # Reloader breaks SSE
        threaded=True
    )
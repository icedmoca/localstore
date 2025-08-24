from pathlib import Path
from flask import Flask, jsonify, request, Response, send_from_directory
from flask_cors import CORS
import json
import os
import time
import shutil
import secrets
import subprocess
import datetime
import venv
import httpx

from state_json import AtomicJSONState
from install import ensure_tool_installed
from proc import ProcManager, venv_python

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
DATA = BACKEND / "data"; DATA.mkdir(exist_ok=True)
TOOLS_DIR = ROOT / "tools"; TOOLS_DIR.mkdir(exist_ok=True)
REGISTRY_PATH = BACKEND / "registry.json"
STATE_PATH = DATA / "install_state.json"

app = Flask(__name__, static_folder=str(ROOT / 'backend' / 'static'), static_url_path='')
CORS(app, origins="*")

state = AtomicJSONState(STATE_PATH)
runtime = ProcManager()

# Import and register dev blueprint
from dev_api import dev_bp
dev_bp.state = state
dev_bp.runtime = runtime
app.register_blueprint(dev_bp)

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/registry")
def get_registry():
    if not REGISTRY_PATH.exists():
        return jsonify([])
    return jsonify(json.loads(REGISTRY_PATH.read_text(encoding="utf-8")))

@app.get("/api/tools")
def list_tools():
    out = []
    for t in state.list_installed():
        # reconcile runtime truth
        if runtime.is_running(t["id"]):
            t["status"] = "running"; t["port"] = runtime.get_port(t["id"]) or t.get("port")
        else:
            t["status"] = "stopped"; t["port"] = None
            # check if died unexpectedly
            pi = runtime.procs.get(t["id"])
            if pi and pi.popen.poll() is not None:
                runtime.procs.pop(t["id"], None)
        out.append(t)
    state.save()
    return jsonify(out)

@app.post("/api/tools/install")
def install_tool():
    tool_id = request.json.get("id")
    reg = {i["id"]: i for i in json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))}
    meta = reg.get(tool_id)
    if not meta:
        return jsonify({"error":"not in registry"}), 404
    info = ensure_tool_installed(tool_id, meta, TOOLS_DIR)
    state.upsert(info)
    return jsonify(info)

@app.post("/api/tools/<tool_id>/start")
def start_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    if runtime.is_running(tool_id):
        return jsonify({"id": tool_id, "status": "running", "port": runtime.get_port(tool_id)})
    
    try:
        port = runtime.start_uvicorn(tool_id, Path(t['venv']), Path(t['path']), t['entry'])
        t['status'] = 'running'
        t['port'] = port
        state.upsert(t)
        return jsonify({"id": tool_id, "status": "running", "port": port})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/tools/<tool_id>/stop")
def stop_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    
    runtime.stop(tool_id)
    t['status'] = 'stopped'
    t['port'] = None
    state.upsert(t)
    return jsonify({"id": tool_id, "status": "stopped", "port": None})

@app.delete("/api/tools/<tool_id>")
def delete_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    
    # Stop if running
    if runtime.is_running(tool_id):
        runtime.stop(tool_id)
    
    # Remove from filesystem
    tool_path = Path(t['path'])
    if tool_path.exists():
        shutil.rmtree(tool_path)
    
    # Remove from state
    state.remove(tool_id)
    return jsonify({"ok": True})

# Creation
@app.post("/api/tools/create/folder")
def create_folder():
    data = request.json
    if state.get(data['id']):
        return jsonify({"error": "ID exists"}), 400
    dest = TOOLS_DIR / data['id']
    try:
        source_path = Path(data['path'])
        if not source_path.exists():
            return jsonify({"error": "Source path does not exist"}), 400
        shutil.copytree(str(source_path), str(dest))
        info = ensure_tool_installed(data['id'], data, TOOLS_DIR)
        state.upsert(info)
        return jsonify(info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/tools/create/git")
def create_git():
    data = request.json
    if state.get(data['id']):
        return jsonify({"error": "ID exists"}), 400
    dest = TOOLS_DIR / data['id']
    try:
        from git import Repo
        Repo.clone_from(data['repo'], dest, branch=data.get('ref', 'main'), depth=1)
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
        return jsonify(info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/tools/create/pip")
def create_pip():
    data = request.json
    if state.get(data['id']):
        return jsonify({"error": "ID exists"}), 400
    dest = TOOLS_DIR / data['id']
    try:
        dest.mkdir(parents=True, exist_ok=True)
        venv_dir = dest / '.venv'
        venv.create(venv_dir, with_pip=True)
        pip_path = venv_python(venv_dir).parent / ('pip.exe' if os.name == 'nt' else 'pip')
        subprocess.check_call([str(pip_path), 'install'] + data['spec'].split())
        
        # Create a minimal app.py if entry point specified
        if data.get('entry'):
            app_py = dest / 'app.py'
            app_py.write_text(f"""# Auto-generated app
from {data['entry'].split(':')[0]} import {data['entry'].split(':')[1]}

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
        return jsonify(info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Runtimes
@app.get("/api/runtimes")
def list_runtimes():
    runtimes = []
    import sys
    import shutil
    
    # Add current python
    runtimes.append({
        "version": f"{sys.version_info.major}.{sys.version_info.minor}",
        "path": sys.executable,
        "default": True,
        "managed": False
    })
    
    # Try to find other pythons
    for py_name in ['python3', 'python3.8', 'python3.9', 'python3.10', 'python3.11', 'python3.12']:
        py_path = shutil.which(py_name)
        if py_path and py_path != sys.executable:
            try:
                result = subprocess.run([py_path, '--version'], capture_output=True, text=True)
                version = result.stdout.strip().split()[-1]
                runtimes.append({
                    "version": version,
                    "path": py_path,
                    "default": False,
                    "managed": False
                })
            except Exception:
                pass
    
    return jsonify(runtimes)

@app.post("/api/runtimes/default")
def set_default_runtime():
    data = request.json
    path = data['path']
    # Store default runtime preference in user state for future use
    return jsonify({"ok": True})

@app.patch("/api/tools/<tool_id>")
def update_tool(tool_id):
    data = request.json
    t = state.get(tool_id)
    if not t:
        return jsonify({"error": "Tool not found"}), 404
    
    if 'autostart' in data:
        t['autostart'] = data['autostart']
    if 'python' in data:
        t['python'] = data['python']
    state.upsert(t)
    return jsonify({"ok": True})

# API key auth
API_KEY = os.getenv('LOCALSTORE_API_KEY')

@app.before_request
def check_auth():
    if not API_KEY:
        return
    # allow non-API routes (SPA/static) without auth
    if not request.path.startswith("/api/"):
        return
    if request.headers.get("Authorization") != f"Bearer {API_KEY}":
        return jsonify({"error": "Unauthorized"}), 401



# Serve SPA - these must be AFTER all API routes to avoid conflicts
@app.get('/')
def spa_index():
    print(f"SPA index called, static_folder: {app.static_folder}")
    return send_from_directory(app.static_folder, 'index.html')

@app.get('/<path:path>')
def spa_catchall(path):
    print(f"SPA catchall called with path: {path}")
    # Don't handle API routes
    if path.startswith('api/'):
        return jsonify({'error': 'Not Found'}), 404
    
    # Check if the file exists (for assets)
    file_path = Path(app.static_folder) / path
    print(f"Looking for file: {file_path}")
    if file_path.exists() and file_path.is_file():
        return send_from_directory(app.static_folder, path)
    
    # Fallback to SPA for client-side routing
    return send_from_directory(app.static_folder, 'index.html')

# On boot, start autostart tools
if __name__ == "__main__":
    for t in state.list_installed():
        if t.get('autostart'):
            try:
                runtime.start_uvicorn(t['id'], Path(t['venv']), Path(t['path']), t['entry'])
            except Exception as e:
                print(f"Failed to autostart {t['id']}: {e}")
    
    # Production vs development mode
    debug_mode = os.getenv('FLASK_DEBUG', '1') == '1'
    # Don't use reloader in debug mode as it breaks streaming generators
    app.run(host="127.0.0.1", port=8000, debug=debug_mode, use_reloader=False)

# SSE logs for running process
@app.get("/api/tools/<tool_id>/logs")
def logs(tool_id: str):
    pi = runtime.procs.get(tool_id)
    if not pi:
        return jsonify({"error": "tool not running"}), 404

    def gen():
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
            txt = line.decode("utf-8", errors="ignore").rstrip("\n")
            yield f'data: {{"event":"log","line":{json.dumps(txt)}}}\n\n'

    return Response(gen(), mimetype="text/event-stream")

# Reverse proxy for running tools
ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]

def _running_port_from_state_or_runtime(actual_id: str):
    # Prefer runtime (truth) if available; fallback to state (may be stale).
    if runtime.is_running(actual_id):
        p = runtime.get_port(actual_id)
        if p:
            return p
    t = state.get(actual_id)
    if t and t.get("port"):
        return t["port"]
    return None

def _filtered_request_headers(h):
    hop_by_hop = {
        "connection","keep-alive","proxy-authenticate","proxy-authorization",
        "te","trailers","transfer-encoding","upgrade","host"
    }
    return {k: v for k, v in h.items() if k.lower() not in hop_by_hop}

@app.route("/api/apps/<tool_id>/", defaults={"subpath": ""}, methods=ALLOWED_METHODS)
@app.route("/api/apps/<tool_id>/<path:subpath>", methods=ALLOWED_METHODS)
def proxy(tool_id: str, subpath: str):
    is_dev = tool_id.startswith("dev-")
    actual_id = tool_id[4:] if is_dev else tool_id

    port = _running_port_from_state_or_runtime(actual_id)
    if not port:
        return jsonify({"error": "tool not running"}), 404

    # Normalize path and carry query string
    tail = subpath.lstrip("/")
    qs = request.query_string.decode("utf-8")
    target_url = f"http://127.0.0.1:{port}/" + (tail if tail else "")
    if qs:
        target_url += ("?" + qs)

    req_method = request.method
    req_headers = _filtered_request_headers(request.headers)
    req_body = request.get_data() if req_method in ("POST","PUT","PATCH") else None

    try:
        with httpx.stream(
            req_method, target_url, headers=req_headers, content=req_body, follow_redirects=True, timeout=30.0
        ) as r:

            def generate():
                for chunk in r.iter_bytes():
                    if chunk:
                        yield chunk

            # Filter response headers
            blocked = {"connection","transfer-encoding","content-encoding","server"}
            resp_headers = [(k, v) for k, v in r.headers.items() if k.lower() not in blocked]
            return Response(generate(), status=r.status_code, headers=resp_headers)
    except httpx.RequestError as e:
        return jsonify({"error": f"proxy error: {e}"}), 502

# Legacy route aliases for compatibility
@app.route('/api/install/<tool_id>', methods=['POST'])
def install_tool_legacy(tool_id):
    return install_tool()

@app.route('/api/uninstall/<tool_id>', methods=['POST'])
def uninstall_tool_legacy(tool_id):
    return uninstall_tool(tool_id)



# Serve SPA - these must be AFTER all API routes to avoid conflicts
@app.get('/')
def spa_index():
    print(f"SPA index called, static_folder: {app.static_folder}")
    return send_from_directory(app.static_folder, 'index.html')

@app.get('/<path:path>')
def spa_catchall(path):
    print(f"SPA catchall called with path: {path}")
    # Don't handle API routes
    if path.startswith('api/'):
        return jsonify({'error': 'Not Found'}), 404
    
    # Check if the file exists (for assets)
    file_path = Path(app.static_folder) / path
    print(f"Looking for file: {file_path}")
    if file_path.exists() and file_path.is_file():
        return send_from_directory(app.static_folder, path)
    
    # Fallback to SPA for client-side routing
    return send_from_directory(app.static_folder, 'index.html')

# Global error handler
@app.errorhandler(Exception)
def on_error(e):
    code = getattr(e, "code", 500)
    msg = str(e) if code < 500 else "internal error"
    return jsonify({"error": msg}), code

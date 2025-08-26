from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import time
import shutil
import secrets
import subprocess
import datetime
import venv
import httpx
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

os.environ.setdefault("FLASK_SKIP_DOTENV", "1")
from state_json import AtomicJSONState
from install import ensure_tool_installed
from proc import ProcManager, venv_python

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
DATA = BACKEND / "data"; DATA.mkdir(exist_ok=True)
TOOLS_DIR = ROOT / "tools"; TOOLS_DIR.mkdir(exist_ok=True)
REGISTRY_PATH = BACKEND / "registry.json"
STATE_PATH = DATA / "install_state.json"
DIST_INDEX = BACKEND / "static" / "index.html"

app = FastAPI(title="LocalStore IDE API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files BEFORE API routes
app.mount("/static", StaticFiles(directory=str(BACKEND / "static" / "assets")), name="static")

state = AtomicJSONState(STATE_PATH)
runtime = ProcManager()

# Pydantic models
class ToolInstall(BaseModel):
    id: str

class ToolUpdate(BaseModel):
    autostart: Optional[bool] = None
    python: Optional[str] = None

class RuntimePath(BaseModel):
    path: str

class RuntimeAdd(BaseModel):
    path: str
    type: str = "python"

class RuntimeDownload(BaseModel):
    url: str
    type: str = "python"

class ToolCreateFolder(BaseModel):
    id: str
    name: str
    path: str
    entry: Optional[str] = None

class ToolCreateGit(BaseModel):
    id: str
    name: str
    repo: str
    ref: Optional[str] = "main"
    subdir: Optional[str] = None
    entry: Optional[str] = None

class ToolCreatePip(BaseModel):
    id: str
    name: str
    spec: str
    entry: str

class FileContent(BaseModel):
    path: str
    content: str = ""

class ToolExec(BaseModel):
    command: str
    python: bool = False

# API Routes
@app.get("/api/health")
async def health():
    return {"ok": True}

@app.get("/api/registry")
async def get_registry():
    if not REGISTRY_PATH.exists():
        return []
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

@app.get("/api/tools")
async def list_tools():
    out = []
    for t in state.list_installed():
        # reconcile runtime truth
        if runtime.is_running(t["id"]):
            t["status"] = "running"
            t["port"] = runtime.get_port(t["id"]) or t.get("port")
        else:
            t["status"] = "stopped"
            t["port"] = None
            # check if died unexpectedly
            pi = runtime.procs.get(t["id"])
            if pi and pi.popen.poll() is not None:
                runtime.procs.pop(t["id"], None)
        out.append(t)
    state.save()
    return out

@app.post("/api/tools/install")
async def install_tool(tool: ToolInstall):
    try:
        tool_id = tool.id
        if not tool_id:
            raise HTTPException(status_code=400, detail="missing id")
        reg = {i["id"]: i for i in json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))}
        meta = reg.get(tool_id)
        if not meta:
            raise HTTPException(status_code=404, detail="not in registry")
        info = ensure_tool_installed(tool_id, meta, TOOLS_DIR)
        state.upsert(info)
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tools/{tool_id}/start")
async def start_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tool not found")
    if runtime.is_running(tool_id):
        return {"id": tool_id, "status": "running", "port": runtime.get_port(tool_id)}
    
    try:
        port = runtime.start_uvicorn(tool_id, Path(t['venv']), Path(t['path']), t['entry'])
        t['status'] = 'running'
        t['port'] = port
        state.upsert(t)
        return {"id": tool_id, "status": "running", "port": port}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tools/{tool_id}/stop")
async def stop_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    runtime.stop(tool_id)
    t['status'] = 'stopped'
    t['port'] = None
    state.upsert(t)
    return {"id": tool_id, "status": "stopped", "port": None}

@app.delete("/api/tools/{tool_id}")
async def delete_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Stop if running
    if runtime.is_running(tool_id):
        runtime.stop(tool_id)
    
    # Remove from filesystem
    tool_path = Path(t['path'])
    if tool_path.exists():
        shutil.rmtree(tool_path)
    
    # Remove from state
    state.remove(tool_id)
    return {"ok": True}

@app.patch("/api/tools/{tool_id}")
async def update_tool(tool_id: str, updates: ToolUpdate):
    t = state.get(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    if updates.autostart is not None:
        t['autostart'] = updates.autostart
    if updates.python is not None:
        t['python'] = updates.python
    state.upsert(t)
    return {"ok": True}

# File system helpers
def _tool_root(tool_id: str) -> Path:
    t = state.get(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tool not found")
    return Path(t['path']).resolve()

def _safe_join(root: Path, rel: str) -> Path:
    p = (root / rel).resolve()
    if not str(p).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Path traversal")
    return p

@app.get('/api/tools/{tool_id}/files')
async def list_tool_files(tool_id: str):
    try:
        root = _tool_root(tool_id)
        if not root.exists():
            raise HTTPException(status_code=404, detail="Tool path not found")
        
        def build_tree(path: Path) -> dict:
            node = { 'type': 'dir', 'name': path.name, 'children': [] }
            try:
                for p in path.iterdir():
                    name = p.name
                    if name in {'.venv', '__pycache__', '.git'}:
                        continue
                    if p.is_dir():
                        node['children'].append(build_tree(p))
                    else:
                        node['children'].append({ 'type': 'file', 'name': name, 'path': str(p.relative_to(root)) })
            except Exception:
                pass
            return node
        return build_tree(root)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Tool not found")

@app.get('/api/tools/{tool_id}/file')
async def read_tool_file(tool_id: str, path: str = ""):
    try:
        if not path:
            raise HTTPException(status_code=400, detail="Missing path")
        root = _tool_root(tool_id)
        target = _safe_join(root, path)
        if not target.exists():
            raise HTTPException(status_code=404, detail="Not found")
        try:
            txt = target.read_text(encoding='utf-8')
        except Exception:
            txt = target.read_text(errors='ignore')
        return {"path": path, "content": txt}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post('/api/tools/{tool_id}/file')
async def write_tool_file(tool_id: str, file_data: FileContent):
    try:
        if not file_data.path:
            raise HTTPException(status_code=400, detail="Missing path")
        root = _tool_root(tool_id)
        target = _safe_join(root, file_data.path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(file_data.content, encoding='utf-8')
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post('/api/tools/{tool_id}/restart')
async def restart_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tool not found")
    # stop
    if runtime.is_running(tool_id):
        runtime.stop(tool_id)
    # start
    try:
        port = runtime.start_uvicorn(tool_id, Path(t['venv']), Path(t['path']), t['entry'])
        t['status'] = 'running'
        t['port'] = port
        state.upsert(t)
        return {"id": tool_id, "status": "running", "port": port}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/api/tools/{tool_id}/exec')
async def exec_in_tool(tool_id: str, exec_data: ToolExec):
    t = state.get(tool_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    command = exec_data.command
    python = exec_data.python
    if not command:
        raise HTTPException(status_code=400, detail="Missing command")
    
    cwd = Path(t['path'])
    vpy = venv_python(Path(t['venv']))
    try:
        if python:
            proc = subprocess.run([str(vpy), '-c', command], cwd=str(cwd), capture_output=True, text=True)
        else:
            # Use shell for convenience; in trusted local environment
            proc = subprocess.run(command, cwd=str(cwd), shell=True, capture_output=True, text=True)
        return {
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Creation endpoints
@app.post("/api/tools/create/folder")
async def create_folder(data: ToolCreateFolder):
    if state.get(data.id):
        raise HTTPException(status_code=400, detail="ID exists")
    dest = TOOLS_DIR / data.id
    try:
        source_path = Path(data.path)
        if not source_path.exists():
            raise HTTPException(status_code=400, detail="Source path does not exist")
        shutil.copytree(str(source_path), str(dest))
        info = ensure_tool_installed(data.id, data.dict(), TOOLS_DIR)
        state.upsert(info)
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tools/create/git")
async def create_git(data: ToolCreateGit):
    if state.get(data.id):
        raise HTTPException(status_code=400, detail="ID exists")
    dest = TOOLS_DIR / data.id
    try:
        from git import Repo
        Repo.clone_from(data.repo, dest, branch=data.ref or 'main', depth=1)
        if data.subdir:
            # Move subdir contents to root
            subdir_path = dest / data.subdir
            if subdir_path.exists():
                temp_dir = dest.parent / f"{data.id}_temp"
                shutil.move(str(subdir_path), str(temp_dir))
                shutil.rmtree(dest)
                shutil.move(str(temp_dir), str(dest))
        info = ensure_tool_installed(data.id, data.dict(), TOOLS_DIR)
        state.upsert(info)
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tools/create/pip")
async def create_pip(data: ToolCreatePip):
    if state.get(data.id):
        raise HTTPException(status_code=400, detail="ID exists")
    dest = TOOLS_DIR / data.id
    try:
        dest.mkdir(parents=True, exist_ok=True)
        venv_dir = dest / '.venv'
        venv.create(venv_dir, with_pip=True)
        pip_path = venv_python(venv_dir).parent / ('pip.exe' if os.name == 'nt' else 'pip')
        subprocess.check_call([str(pip_path), 'install'] + data.spec.split())
        
        # Create a minimal app.py if entry point specified
        if data.entry:
            app_py = dest / 'app.py'
            app_py.write_text(f"""# Auto-generated app
from {data.entry.split(':')[0]} import {data.entry.split(':')[1]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
""")
        
        info = {
            'id': data.id, 
            'name': data.name, 
            'entry': data.entry or 'app:app', 
            'path': str(dest), 
            'venv': str(venv_dir),
            'status': 'stopped',
            'port': None
        }
        state.upsert(info)
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Runtimes
@app.get("/api/runtimes")
async def list_runtimes():
    runtimes = []
    import sys
    import shutil
    
    # Add current python
    runtimes.append({
        "version": f"{sys.version_info.major}.{sys.version_info.minor}",
        "path": sys.executable,
        "type": "python",
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
                    "type": "python",
                    "default": False,
                    "managed": False
                })
            except Exception:
                pass
    
    # Try to find Node.js
    node_path = shutil.which('node')
    if node_path:
        try:
            result = subprocess.run([node_path, '--version'], capture_output=True, text=True)
            version = result.stdout.strip()
            runtimes.append({
                "version": version,
                "path": node_path,
                "type": "node",
                "default": False,
                "managed": False
            })
        except Exception:
            pass
    
    # Try to find Ruby
    ruby_path = shutil.which('ruby')
    if ruby_path:
        try:
            result = subprocess.run([ruby_path, '--version'], capture_output=True, text=True)
            version = result.stdout.strip().split()[1]
            runtimes.append({
                "version": version,
                "path": ruby_path,
                "type": "ruby",
                "default": False,
                "managed": False
            })
        except Exception:
            pass
    
    return runtimes

@app.post("/api/runtimes/default")
async def set_default_runtime(runtime_path: RuntimePath):
    # Store default runtime preference in user state for future use
    return {"ok": True}

@app.post("/api/runtimes")
async def add_runtime(data: RuntimeAdd):
    """Add a new runtime"""
    if not data.path:
        raise HTTPException(status_code=400, detail="Runtime path is required")
    
    # Validate runtime exists
    if not Path(data.path).exists():
        raise HTTPException(status_code=404, detail=f"Runtime not found at {data.path}")
    
    # Get version info
    version = "Unknown"
    try:
        if data.type == "python":
            result = subprocess.run([data.path, "--version"], capture_output=True, text=True)
            version = result.stdout.strip() or result.stderr.strip()
        elif data.type == "node":
            result = subprocess.run([data.path, "--version"], capture_output=True, text=True)
            version = result.stdout.strip()
        # Add more runtime types as needed
    except Exception:
        pass
    
    # Store runtime info (in real implementation, save to state)
    runtime_info = {
        "path": data.path,
        "type": data.type,
        "version": version,
        "default": False,
        "managed": False
    }
    
    return runtime_info

@app.post("/api/runtimes/download")
async def download_runtime(data: RuntimeDownload):
    """Download and install a runtime from URL"""
    if not data.url:
        raise HTTPException(status_code=400, detail="Download URL is required")
    
    # In real implementation, download and install the runtime
    # This is a placeholder response
    return {
        "ok": True,
        "message": f"Runtime download started for {data.type} from {data.url}"
    }

# API key auth
API_KEY = os.getenv('LOCALSTORE_API_KEY')

@app.middleware("http")
async def check_auth(request: Request, call_next):
    if not API_KEY:
        response = await call_next(request)
        return response
    
    # allow non-API routes (SPA/static) without auth
    if not request.url.path.startswith("/api/"):
        response = await call_next(request)
        return response
    
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {API_KEY}":
        return JSONResponse(
            status_code=401,
            content={"error": "Unauthorized"}
        )
    
    response = await call_next(request)
    return response

# SSE logs for running process
@app.get("/api/tools/{tool_id}/logs")
async def logs(tool_id: str):
    pi = runtime.procs.get(tool_id)
    if not pi:
        raise HTTPException(status_code=404, detail="tool not running")

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

    from fastapi.responses import StreamingResponse
    return StreamingResponse(gen(), media_type="text/event-stream")

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

@app.api_route("/api/apps/{tool_id}", methods=ALLOWED_METHODS)
@app.api_route("/api/apps/{tool_id}/{subpath:path}", methods=ALLOWED_METHODS)
async def proxy(request: Request, tool_id: str, subpath: str = ""):
    is_dev = tool_id.startswith("dev-")
    actual_id = tool_id[4:] if is_dev else tool_id

    port = _running_port_from_state_or_runtime(actual_id)
    if not port:
        raise HTTPException(status_code=404, detail="tool not running")

    # Normalize path and carry query string
    tail = subpath.lstrip("/")
    qs = str(request.url.query)
    target_url = f"http://127.0.0.1:{port}/" + (tail if tail else "")
    if qs:
        target_url += ("?" + qs)

    req_method = request.method
    req_headers = _filtered_request_headers(request.headers)
    req_body = await request.body() if req_method in ("POST","PUT","PATCH") else None

    try:
        # Use regular request instead of stream for better compatibility
        async with httpx.AsyncClient() as client:
            r = await client.request(
                req_method, target_url, headers=req_headers, content=req_body, follow_redirects=True, timeout=30.0
            )
        
        # Filter response headers
        blocked = {"connection","transfer-encoding","content-encoding","server"}
        resp_headers = {k: v for k, v in r.headers.items() if k.lower() not in blocked}
        
        from fastapi.responses import Response
        return Response(r.content, status_code=r.status_code, headers=resp_headers)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"proxy error: {e}")

# Legacy route aliases for compatibility
@app.post('/api/install/{tool_id}')
async def install_tool_legacy(tool_id: str):
    return await install_tool(ToolInstall(id=tool_id))

@app.post('/api/uninstall/{tool_id}')
async def uninstall_tool_legacy(tool_id: str):
    return await delete_tool(tool_id)

# SPA fallback - this MUST be last to catch all non-API routes
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    # Don't handle API routes or static assets
    if full_path.startswith("api") or full_path.startswith("static"):
        raise HTTPException(status_code=404, detail="Not found")
    
    # Check if the file exists (for assets like fonts, images)
    file_path = BACKEND / "static" / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    
    # Fallback to SPA for client-side routing
    if DIST_INDEX.exists():
        return FileResponse(DIST_INDEX)
    else:
        raise HTTPException(status_code=404, detail="SPA index.html not found")

# On startup, start autostart tools
def startup_autostart_tools():
    for t in state.list_installed():
        if t.get('autostart'):
            try:
                runtime.start_uvicorn(t['id'], Path(t['venv']), Path(t['path']), t['entry'])
            except Exception as e:
                print(f"Failed to autostart {t['id']}: {e}")

if __name__ == "__main__":
    import uvicorn
    
    # Start autostart tools
    startup_autostart_tools()
    
    # Production vs development mode
    debug_mode = os.getenv('FLASK_DEBUG', '1') == '1'
    print(f"Starting FastAPI server on http://127.0.0.1:8000 (debug={debug_mode})")
    
    if debug_mode:
        uvicorn.run("fastapi_app:app", host="127.0.0.1", port=8000, reload=True)
    else:
        uvicorn.run(app, host="127.0.0.1", port=8000)

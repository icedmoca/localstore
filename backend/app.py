from pathlib import Path
from flask import Flask, jsonify, request, Response, send_from_directory
from flask_cors import CORS
import json
import os
import time

from state_json import AtomicJSONState
from install import ensure_tool_installed
from proc import ProcManager, venv_python

app = Flask(__name__)
CORS(app)

# Import and register dev blueprint
from dev_api import dev_bp
app.register_blueprint(dev_bp)

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
DATA = BACKEND / "data"; DATA.mkdir(exist_ok=True)
TOOLS_DIR = ROOT / "tools"; TOOLS_DIR.mkdir(exist_ok=True)
REGISTRY_PATH = BACKEND / "registry.json"
STATE_PATH = DATA / "install_state.json"

state = AtomicJSONState(STATE_PATH)
runtime = ProcManager()

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
        return jsonify({"error":"not installed"}), 404
    port = runtime.start_uvicorn(tool_id, Path(t["venv"]), Path(t["path"]), t.get("entry", "app:app"))
    t["status"] = "running"; t["port"] = port
    state.upsert(t)
    return jsonify({"id": tool_id, "status": "running", "port": port})

@app.post("/api/tools/<tool_id>/stop")
def stop_tool(tool_id: str):
    t = state.get(tool_id)
    if not t:
        return jsonify({"error":"not installed"}), 404
    runtime.stop(tool_id)
    t["status"] = "stopped"; t["port"] = None
    state.upsert(t)
    return jsonify({"id": tool_id, "status": "stopped", "port": None})

@app.delete("/api/tools/<tool_id>")
def uninstall_tool(tool_id: str):
    runtime.stop(tool_id)
    state.remove(tool_id)
    return jsonify({"ok": True})

# SSE logs for running process
@app.get("/api/tools/<tool_id>/logs")
def logs(tool_id: str):
    pi = runtime.procs.get(tool_id)
    if not pi:
        return jsonify({"error":"tool not running"}), 404

    def gen():
        yield "retry: 1500\n\n"
        f = pi.popen.stdout
        while True:
            if pi.popen.poll() is not None:
                yield f"data: {{\"event\":\"exit\",\"code\":{pi.popen.returncode}}}\n\n"
                break
            line = f.readline()
            if not line:
                time.sleep(0.1)
                continue
            try:
                txt = line.decode("utf-8", errors="ignore").rstrip("\n")
            except Exception:
                txt = str(line)
            yield f"data: {{\"event\":\"log\",\"line\":{json.dumps(txt)} }}\n\n"
    return Response(gen(), mimetype="text/event-stream")

# Reverse proxy for running tools
@app.route("/api/apps/<tool_id>/", defaults={"path": ""}, methods=["GET","POST","PUT","PATCH","DELETE"])
@app.route("/api/apps/<tool_id>/<path:path>", methods=["GET","POST","PUT","PATCH","DELETE"])
def proxy(tool_id: str, path: str):
    t = state.get(tool_id)
    if not t or not t.get("port"):
        return jsonify({"error": "tool not running"}), 404

    target = f"http://127.0.0.1:{t['port']}/{path}"
    headers = {k: v for k, v in request.headers if k.lower() != "host"}
    body = request.get_data()

    # stream response to client
    import httpx
    with httpx.stream(request.method, target, headers=headers, content=body, follow_redirects=True, timeout=30.0) as r:
        def gen():
            for chunk in r.iter_bytes():
                yield chunk
        resp = Response(gen(), status=r.status_code)
        for k, v in r.headers.items():
            # pass through useful headers
            if k.lower() in ("content-type", "content-length", "cache-control", "etag"):
                resp.headers[k] = v
        return resp

# Legacy route aliases for compatibility
@app.route('/api/install/<tool_id>', methods=['POST'])
def install_tool_legacy(tool_id):
    return install_tool()

@app.route('/api/uninstall/<tool_id>', methods=['POST'])
def uninstall_tool_legacy(tool_id):
    return uninstall_tool(tool_id)

# Serve frontend
@app.route('/')
def index():
    return send_from_directory('../frontend/dist', 'index.html')

@app.route('/<path:path>')
def serve_frontend(path):
    return send_from_directory('../frontend/dist', path)

# Global error handler
@app.errorhandler(Exception)
def on_error(e):
    code = getattr(e, "code", 500)
    msg = str(e) if code < 500 else "internal error"
    return jsonify({"error": msg}), code

if __name__ == "__main__":
    # Bind 127.0.0.1:8000 to match Vite proxy
    app.run(host="127.0.0.1", port=8000, debug=True)

from __future__ import annotations
from flask import Blueprint, request, jsonify, Response, stream_template
from pathlib import Path
import asyncio
import json
import os
import shutil
import subprocess
from typing import Dict, Any
import time

from dev_paths import dev_root, tool_workspace
import venv

# Create Flask blueprint
dev_bp = Blueprint('dev', __name__, url_prefix='/api/dev')

# These will be injected from app.py
#state = None  # type: ignore
#runtime = None  # type: ignore

@dev_bp.route('/<tool_id>/fork', methods=['POST'])
def fork_tool(tool_id: str):
    state = dev_bp.state
    tool = state.get(tool_id)
    if not tool:
        return jsonify({"error": "Tool not installed"}), 404
    src = Path(tool['path']).resolve()
    dest = tool_workspace(tool_id)
    if dest.exists():
        return jsonify({"ok": True, "path": str(dest)})
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Copy without .venv
    ignore_venv = shutil.ignore_patterns('.venv')
    shutil.copytree(src, dest, ignore=ignore_venv)
    # Recreate fresh venv
    venv_dir = dest / ".venv"
    venv.EnvBuilder(with_pip=True).create(venv_dir)
    pip = venv_dir / ("Scripts" if os.name == "nt" else "bin") / "pip"
    req = dest / "requirements.txt"
    if req.exists():
        subprocess.check_call([str(pip), "install", "-r", str(req)])
    else:
        setup_py = dest / "setup.py"
        pyproject = dest / "pyproject.toml"
        if setup_py.exists() or pyproject.exists():
            subprocess.check_call([str(pip), "install", "."], cwd=str(dest))
        else:
            subprocess.check_call([str(pip), "install", "uvicorn"])
    # init git repo (optional)
    try:
        subprocess.check_call(["git", "init"], cwd=str(dest))
        subprocess.check_call(["git", "add", "."], cwd=str(dest))
        subprocess.check_call(["git", "commit", "-m", "Initial fork"], cwd=str(dest))
    except Exception:
        pass
    return jsonify({"ok": True, "path": str(dest)})

@dev_bp.route('/<tool_id>/files')
def list_files(tool_id: str):
    root = tool_workspace(tool_id)
    if not root.exists():
        return jsonify({"error": "No workspace; fork first"}), 404
    def build_tree(path: Path) -> dict:
        out = {'type': 'dir', 'name': path.name, 'children': []}
        for p in path.iterdir():
            if p.is_dir():
                out['children'].append(build_tree(p))
            else:
                out['children'].append({'type': 'file', 'name': p.name, 'path': str(p.relative_to(root))})
        return out
    tree = build_tree(root)
    return jsonify(tree)

@dev_bp.route('/<tool_id>/file')
def read_file(tool_id: str):
    path = request.args.get('path')
    if not path:
        return jsonify({"error": "Missing path parameter"}), 400
    
    root = tool_workspace(tool_id)
    target = (root / path).resolve()
    if not str(target).startswith(str(root.resolve())):
        return jsonify({"error": "Path traversal"}), 400
    if not target.exists():
        return jsonify({"error": "Not found"}), 404
    try:
        content = target.read_text(encoding='utf-8')
    except Exception:
        content = target.read_text(errors='ignore')
    return jsonify({"path": path, "content": content})

@dev_bp.route('/<tool_id>/file', methods=['POST'])
def write_file(tool_id: str):
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400
    
    path = payload.get('path')
    content = payload.get('content', '')
    if not path:
        return jsonify({"error": "Missing path"}), 400
    
    root = tool_workspace(tool_id)
    if not root.exists():
        return jsonify({"error": "No workspace; fork first"}), 404
    
    target = (root / path).resolve()
    if not str(target).startswith(str(root.resolve())):
        return jsonify({"error": "Path traversal"}), 400
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
    return jsonify({"ok": True})

@dev_bp.route('/<tool_id>/patch', methods=['POST'])
def apply_patch_api(tool_id: str):
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400
    
    patch_text = payload.get('patch', '')
    if not patch_text:
        return jsonify({"error": "Missing patch"}), 400
    
    root = tool_workspace(tool_id)
    if not root.exists():
        return jsonify({"error": "No workspace; fork first"}), 404
    
    try:
        from unidiff import PatchSet
        patch = PatchSet.from_string(patch_text)
        applied = []
        for patched_file in patch:
            rel_path = patched_file.path
            target = (root / rel_path).resolve()
            if not str(target).startswith(str(root.resolve())):
                raise ValueError('Path traversal detected')
            if patched_file.is_added_file:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(''.join(hunk.target_lines for hunk in patched_file), encoding='utf-8')
            elif patched_file.is_removed_file:
                if target.exists():
                    target.unlink()
            else:
                with open(target, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                for hunk in patched_file:
                    start = hunk.target_start - 1
                    end = start + hunk.target_length
                    new_lines = [line.value for line in hunk.target_lines()]
                    lines[start:end] = new_lines
                target.write_text(''.join(lines), encoding='utf-8')
            applied.append({"path": rel_path, "added": patched_file.added, "removed": patched_file.removed})
        return jsonify({"ok": True, "files": applied})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@dev_bp.route('/<tool_id>/run', methods=['POST'])
def run_control(tool_id: str):
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400
    
    action = payload.get('action')
    if action not in {'start','stop'}:
        return jsonify({"error": "action must be start|stop"}), 400
    
    runtime = dev_bp.runtime
    state = dev_bp.state
    dev_id = f"dev-{tool_id}"
    ws = tool_workspace(tool_id)
    if not ws.exists():
        return jsonify({"error": "No workspace; fork first"}), 404
    
    tool = state.get(tool_id)
    if not tool:
        return jsonify({"error": "Original tool not found"}), 404
    
    venv_dir = ws / ".venv"
    if not venv_dir.exists():
        return jsonify({"error": "Venv not found in workspace"}), 404
    
    entry = tool.get("entry", "app:app")
    
    if action == 'start':
        if runtime.is_running(dev_id):
            port = runtime.get_port(dev_id)
            return jsonify({"id": tool_id, "status": "running", "port": port})
        port = runtime.start_uvicorn(dev_id, venv_dir, ws, entry)
        return jsonify({"id": tool_id, "status": "running", "port": port})
    else:
        runtime.stop(dev_id)
        return jsonify({"id": tool_id, "status": "stopped"})

@dev_bp.route('/<tool_id>/logs')
def logs(tool_id: str):
    runtime = dev_bp.runtime
    dev_id = f"dev-{tool_id}"
    pi = runtime.procs.get(dev_id)
    if not pi:
        return jsonify({"error":"tool not running in dev mode"}), 404

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

@dev_bp.route('/<tool_id>/chat', methods=['POST'])
def chat_stub(tool_id: str):
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400
    
    # Future: Integrate with AI service for generating patches (Claude, GPT, etc.)
    # MVP stub: echo back a tiny patch that adds a comment to app.py if present
    msg = (payload.get('message') or '').lower()
    ws = tool_workspace(tool_id)
    app_py = ws / 'app.py'
    patch = ''
    if app_py.exists():
        patch = f"""--- a/app.py\n+++ b/app.py\n@@\n+# change requested: {msg}\n"""
    return jsonify({"messages": [{"role":"assistant","content":"Proposed patch generated."}], "patch": patch})

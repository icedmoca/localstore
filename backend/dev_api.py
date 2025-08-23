from __future__ import annotations
from flask import Blueprint, request, jsonify, Response, stream_template
from pathlib import Path
import asyncio
import json
import os
import shutil
import subprocess
from typing import Dict, Any

from dev_paths import dev_root, tool_workspace

# Create Flask blueprint
dev_bp = Blueprint('dev', __name__, url_prefix='/api/dev')

# These will be injected from app.py
state = None  # type: ignore
runtime = None  # type: ignore

@dev_bp.route('/<tool_id>/fork', methods=['POST'])
def fork_tool(tool_id: str):
    tool = state.get(tool_id) if state else None
    if not tool:
        return jsonify({"error": "Tool not installed"}), 404
    src = Path(tool['path']).resolve()
    dest = tool_workspace(tool_id)
    if dest.exists():
        # keep existing workspace
        return jsonify({"ok": True, "path": str(dest)})
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest)
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
    out = []
    for p in root.rglob('*'):
        if p.is_file():
            out.append({"path": str(p.relative_to(root))})
    return jsonify(out)

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
        from patch_utils import apply_unified_diff
        res = apply_unified_diff(root, patch_text)
        return jsonify({"ok": True, "files": res})
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
    
    if action == 'start':
        # For now, return mock info since we don't have runtime
        return jsonify({"id": tool_id, "status": "started"})
    else:
        return jsonify({"id": tool_id, "status": "stopped"})

@dev_bp.route('/<tool_id>/logs')
def logs(tool_id: str):
    # For now, return mock logs since we don't have runtime
    def generate():
        yield 'retry: 2000\n\n'
        yield f'data: {{"event":"log","line":"Mock log for {tool_id}"}}\n\n'
        yield f'data: {{"event":"log","line":"Tool {tool_id} is running in dev mode"}}\n\n'
    
    return Response(generate(), mimetype='text/event-stream')

@dev_bp.route('/<tool_id>/chat', methods=['POST'])
def chat_stub(tool_id: str):
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400
    
    # MVP stub: echo back a tiny patch that adds a comment to app.py if present
    msg = (payload.get('message') or '').lower()
    ws = tool_workspace(tool_id)
    app_py = ws / 'app.py'
    patch = ''
    if app_py.exists():
        patch = f"""--- a/app.py\n+++ b/app.py\n@@\n+# change requested: {msg}\n"""
    return jsonify({"messages": [{"role":"assistant","content":"Proposed patch generated."}], "patch": patch})

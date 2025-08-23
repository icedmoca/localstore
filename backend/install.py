from __future__ import annotations
import os, shutil, subprocess, sys
from pathlib import Path
import venv

class InstallError(Exception):
    pass

def ensure_tool_installed(tool_id: str, meta: dict, tools_dir: Path) -> dict:
    """Copy source, create venv, pip install requirements or package. Return tool info dict."""
    dest = tools_dir / tool_id
    if dest.exists():
        shutil.rmtree(dest)
    src = meta.get("path")
    if not src:
        raise InstallError("Registry item missing 'path'")
    src_path = (tools_dir.parent / src).resolve()
    if not src_path.exists():
        raise InstallError(f"Source not found: {src_path}")
    shutil.copytree(src_path, dest)

    # venv
    venv_dir = dest / ".venv"
    venv.EnvBuilder(with_pip=True).create(venv_dir)
    pip = venv_dir / ("Scripts" if os.name == "nt" else "bin") / "pip"

    req = dest / "requirements.txt"
    if req.exists():
        subprocess.check_call([str(pip), "install", "-r", str(req)])
    else:
        # attempt install package if setup/pyproject exists, otherwise ensure uvicorn present
        setup_py = dest / "setup.py"
        pyproject = dest / "pyproject.toml"
        if setup_py.exists() or pyproject.exists():
            subprocess.check_call([str(pip), "install", "."], cwd=str(dest))
        else:
            subprocess.check_call([str(pip), "install", "uvicorn"])  # minimal

    return {
        "id": tool_id,
        "name": meta.get("name", tool_id),
        "description": meta.get("description", ""),
        "status": "stopped",
        "port": None,
        "path": str(dest),
        "venv": str(venv_dir),
        "entry": meta.get("entry", "app:app"),
    }

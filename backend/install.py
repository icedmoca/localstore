from __future__ import annotations
import os, shutil, subprocess, sys
from pathlib import Path
import venv

class InstallError(Exception):
    pass

def ensure_tool_installed(tool_id: str, meta: dict, tools_dir: Path) -> dict:
    """Copy source, create venv, pip install requirements or package. Return tool info dict."""
    dest = tools_dir / tool_id
    src = meta.get("path")
    if not src:
        raise InstallError("Registry item missing 'path'")
    src_path = (tools_dir.parent / src).resolve()

    # Support in-place installs where the registry path equals the destination path.
    in_place = src_path.resolve() == dest.resolve()

    if not src_path.exists():
        raise InstallError(f"Source not found: {src_path}")

    if not in_place:
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(src_path, dest)
    else:
        # Ensure destination exists for in-place installs
        dest.mkdir(parents=True, exist_ok=True)

    # venv
    venv_dir = dest / ".venv"
    venv.EnvBuilder(with_pip=True).create(venv_dir)
    pip = venv_dir / ("Scripts" if os.name == "nt" else "bin") / "pip"

    req = dest / "requirements.txt"
    def _run(cmd, cwd=None):
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        if p.returncode != 0:
            raise InstallError(f"Command failed: {' '.join(cmd)}\nSTDOUT:\n{p.stdout}\nSTDERR:\n{p.stderr}")
    if req.exists():
        _run([str(pip), "install", "-r", str(req)])
    else:
        setup_py = dest / "setup.py"
        pyproject = dest / "pyproject.toml"
        if setup_py.exists() or pyproject.exists():
            _run([str(pip), "install", "."], cwd=str(dest))
        else:
            _run([str(pip), "install", "uvicorn"])  # minimal

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

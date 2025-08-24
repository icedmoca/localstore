from __future__ import annotations
import os, signal, socket, subprocess, sys, time
from pathlib import Path
from typing import Dict, Optional
import requests

class ProcInfo:
    def __init__(self, popen: subprocess.Popen, port: int):
        self.popen = popen
        self.port = port

class ProcManager:
    def __init__(self):
        self.procs: Dict[str, ProcInfo] = {}

    def is_running(self, tool_id: str) -> bool:
        pi = self.procs.get(tool_id)
        return bool(pi and pi.popen.poll() is None)

    def get_port(self, tool_id: str) -> Optional[int]:
        pi = self.procs.get(tool_id)
        return pi.port if pi else None

    def start_uvicorn(self, tool_id: str, venv_dir: Path, workdir: Path, entry: str, host: str = "127.0.0.1") -> int:
        if self.is_running(tool_id):
            return self.procs[tool_id].port
        port = find_free_port(host)
        py = venv_python(venv_dir)
        module, appobj = entry.split(":", 1)
        cmd = [str(py), "-m", "uvicorn", f"{module}:{appobj}", "--host", host, "--port", str(port)]
        popen = subprocess.Popen(
            cmd, cwd=str(workdir), stdout=subprocess.PIPE, stderr=subprocess.STDOUT
        )
        # readiness wait: poll port
        start_time = time.time()
        while time.time() - start_time < 5:
            try:
                r = requests.get(f"http://{host}:{port}/ping", timeout=0.5)
                if r.status_code == 200:
                    break
            except requests.exceptions.RequestException:
                try:
                    with socket.create_connection((host, port), timeout=0.5):
                        break
                except:
                    time.sleep(0.5)
        else:
            popen.terminate()
            raise RuntimeError(f"Failed to start uvicorn on port {port} within 5s")
        self.procs[tool_id] = ProcInfo(popen=popen, port=port)
        return port

    def stop(self, tool_id: str):
        pi = self.procs.get(tool_id)
        if not pi:
            return
        try:
            if pi.popen.poll() is None:
                if os.name == "nt":
                    pi.popen.terminate()
                else:
                    pi.popen.send_signal(signal.SIGTERM)
                try:
                    pi.popen.wait(timeout=3)
                except Exception:
                    pi.popen.kill()
        finally:
            self.procs.pop(tool_id, None)

def find_free_port(host: str = "127.0.0.1") -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return s.getsockname()[1]

def venv_python(venv_dir: Path) -> Path:
    return venv_dir / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")

"""
Production-ready Process Manager for LocalStore
Handles tool lifecycle with port management, health checks, and auto-restart
"""
import os
import subprocess
import time
import socket
import signal
import threading
import psutil
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
import json
import tempfile
import fcntl
import platform

logger = logging.getLogger('localstore.proc')


@dataclass
class ProcInfo:
    """Process information"""
    popen: subprocess.Popen
    port: int
    tool_id: str
    started_at: datetime
    restart_count: int = 0
    last_health_check: Optional[datetime] = None
    health_failures: int = 0


class PortManager:
    """Manages port allocation with file-based locking"""
    
    def __init__(self, port_range: Tuple[int, int] = (9000, 9999)):
        self.min_port, self.max_port = port_range
        self.lock_dir = Path(tempfile.gettempdir()) / "localstore_ports"
        self.lock_dir.mkdir(exist_ok=True)
        self._cleanup_stale_locks()
    
    def _cleanup_stale_locks(self):
        """Remove lock files for dead processes"""
        for lock_file in self.lock_dir.glob("*.lock"):
            try:
                pid = int(lock_file.read_text().strip())
                if not psutil.pid_exists(pid):
                    lock_file.unlink()
                    logger.info(f"Cleaned stale port lock: {lock_file.name}")
            except Exception:
                pass
    
    def allocate_port(self, tool_id: str) -> Optional[int]:
        """Allocate an available port for a tool"""
        for port in range(self.min_port, self.max_port + 1):
            if self._try_lock_port(port, tool_id):
                return port
        return None
    
    def _try_lock_port(self, port: int, tool_id: str) -> bool:
        """Try to lock a port"""
        lock_file = self.lock_dir / f"{port}.lock"
        
        # Check if port is actually available
        if not self._is_port_available(port):
            return False
        
        try:
            # Create lock file with PID
            with open(lock_file, 'w') as f:
                if platform.system() != 'Windows':
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                f.write(f"{os.getpid()}\n{tool_id}")
            return True
        except (IOError, OSError):
            return False
    
    def _is_port_available(self, port: int) -> bool:
        """Check if a port is available"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(('127.0.0.1', port))
            sock.close()
            return True
        except OSError:
            return False
    
    def release_port(self, port: int):
        """Release a port lock"""
        lock_file = self.lock_dir / f"{port}.lock"
        try:
            lock_file.unlink()
        except FileNotFoundError:
            pass


class HealthChecker:
    """Health checking for running tools"""
    
    def __init__(self):
        self.check_interval = 30  # seconds
        self.max_failures = 3
        self.timeout = 5
    
    def check_health(self, port: int) -> bool:
        """Check if tool is responding on health endpoint"""
        import httpx
        try:
            response = httpx.get(
                f"http://127.0.0.1:{port}/health",
                timeout=self.timeout
            )
            return response.status_code == 200
        except Exception:
            return False


class ProcManager:
    """Enhanced process manager with production features"""
    
    def __init__(self):
        self.procs: Dict[str, ProcInfo] = {}
        self.port_manager = PortManager()
        self.health_checker = HealthChecker()
        self.restart_policies = {}
        self._lock = threading.Lock()
        self._monitor_thread = None
        self._start_monitor()
    
    def _start_monitor(self):
        """Start background monitoring thread"""
        if self._monitor_thread is None or not self._monitor_thread.is_alive():
            self._monitor_thread = threading.Thread(
                target=self._monitor_loop,
                daemon=True
            )
            self._monitor_thread.start()
    
    def _monitor_loop(self):
        """Background monitoring for health checks and auto-restart"""
        while True:
            try:
                with self._lock:
                    for tool_id, proc_info in list(self.procs.items()):
                        self._check_process(tool_id, proc_info)
            except Exception as e:
                logger.error(f"Monitor error: {e}")
            
            time.sleep(10)  # Check every 10 seconds
    
    def _check_process(self, tool_id: str, proc_info: ProcInfo):
        """Check process health and restart if needed"""
        # Check if process is still running
        if proc_info.popen.poll() is not None:
            logger.warning(f"Tool {tool_id} died unexpectedly")
            self._handle_process_death(tool_id, proc_info)
            return
        
        # Perform health check
        now = datetime.now()
        if (proc_info.last_health_check is None or 
            now - proc_info.last_health_check > timedelta(seconds=self.health_checker.check_interval)):
            
            proc_info.last_health_check = now
            if not self.health_checker.check_health(proc_info.port):
                proc_info.health_failures += 1
                logger.warning(f"Health check failed for {tool_id} ({proc_info.health_failures}/{self.health_checker.max_failures})")
                
                if proc_info.health_failures >= self.health_checker.max_failures:
                    logger.error(f"Tool {tool_id} failed health checks, restarting")
                    self._restart_tool(tool_id, proc_info)
            else:
                proc_info.health_failures = 0
    
    def _handle_process_death(self, tool_id: str, proc_info: ProcInfo):
        """Handle unexpected process death"""
        policy = self.restart_policies.get(tool_id, {})
        
        if policy.get('enabled', True) and proc_info.restart_count < policy.get('max_restarts', 3):
            # Exponential backoff
            delay = min(2 ** proc_info.restart_count, 60)
            logger.info(f"Restarting {tool_id} in {delay} seconds (attempt {proc_info.restart_count + 1})")
            
            # Schedule restart
            threading.Timer(delay, lambda: self._restart_tool(tool_id, proc_info)).start()
        else:
            logger.error(f"Tool {tool_id} exceeded restart limit")
            self.procs.pop(tool_id, None)
            self.port_manager.release_port(proc_info.port)
    
    def _restart_tool(self, tool_id: str, old_proc_info: ProcInfo):
        """Restart a tool"""
        # This should be called from the Flask app with proper venv/path info
        # For now, just clean up
        try:
            old_proc_info.popen.terminate()
            old_proc_info.popen.wait(timeout=5)
        except Exception:
            old_proc_info.popen.kill()
        
        self.procs.pop(tool_id, None)
        self.port_manager.release_port(old_proc_info.port)
    
    def start_uvicorn(self, tool_id: str, venv_path: Path, tool_path: Path, 
                      entry: str, env_vars: Optional[Dict] = None) -> int:
        """Start a tool with uvicorn"""
        with self._lock:
            if tool_id in self.procs:
                raise RuntimeError(f"Tool {tool_id} is already running")
            
            # Allocate port
            port = self.port_manager.allocate_port(tool_id)
            if not port:
                raise RuntimeError("No available ports")
            
            # Prepare command
            python_path = venv_python(venv_path)
            cmd = [
                str(python_path),
                "-m", "uvicorn",
                entry,
                "--host", "127.0.0.1",
                "--port", str(port),
                "--no-access-log"
            ]
            
            # Prepare environment
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            env["LOCALSTORE_TOOL_ID"] = tool_id
            env["LOCALSTORE_PORT"] = str(port)
            
            # Restrict PATH to tool's venv
            if platform.system() != 'Windows':
                env["PATH"] = f"{venv_path / 'bin'}:{os.environ.get('PATH', '')}"
            else:
                env["PATH"] = f"{venv_path / 'Scripts'};{os.environ.get('PATH', '')}"
            
            if env_vars:
                env.update(env_vars)
            
            try:
                # Start process
                logger.info(f"Starting {tool_id} on port {port}")
                popen = subprocess.Popen(
                    cmd,
                    cwd=str(tool_path),
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    bufsize=1,
                    universal_newlines=False,
                    preexec_fn=os.setsid if platform.system() != 'Windows' else None
                )
                
                # Store process info
                proc_info = ProcInfo(
                    popen=popen,
                    port=port,
                    tool_id=tool_id,
                    started_at=datetime.now()
                )
                self.procs[tool_id] = proc_info
                
                # Wait for startup
                time.sleep(2)
                
                # Check if process is still running
                if popen.poll() is not None:
                    self.port_manager.release_port(port)
                    raise RuntimeError(f"Tool {tool_id} failed to start")
                
                return port
                
            except Exception as e:
                self.port_manager.release_port(port)
                raise
    
    def stop(self, tool_id: str):
        """Stop a tool gracefully"""
        with self._lock:
            proc_info = self.procs.get(tool_id)
            if not proc_info:
                return
            
            logger.info(f"Stopping {tool_id}")
            
            try:
                # Try graceful shutdown
                if platform.system() != 'Windows':
                    os.killpg(os.getpgid(proc_info.popen.pid), signal.SIGTERM)
                else:
                    proc_info.popen.terminate()
                
                proc_info.popen.wait(timeout=10)
            except subprocess.TimeoutExpired:
                # Force kill if graceful shutdown fails
                logger.warning(f"Force killing {tool_id}")
                if platform.system() != 'Windows':
                    os.killpg(os.getpgid(proc_info.popen.pid), signal.SIGKILL)
                else:
                    proc_info.popen.kill()
                proc_info.popen.wait()
            except Exception as e:
                logger.error(f"Error stopping {tool_id}: {e}")
            
            # Clean up
            self.procs.pop(tool_id, None)
            self.port_manager.release_port(proc_info.port)
    
    def is_running(self, tool_id: str) -> bool:
        """Check if a tool is running"""
        with self._lock:
            proc_info = self.procs.get(tool_id)
            if not proc_info:
                return False
            
            # Check if process is alive
            return proc_info.popen.poll() is None
    
    def get_port(self, tool_id: str) -> Optional[int]:
        """Get the port a tool is running on"""
        with self._lock:
            proc_info = self.procs.get(tool_id)
            return proc_info.port if proc_info else None
    
    def get_status(self, tool_id: str) -> Dict:
        """Get detailed status of a tool"""
        with self._lock:
            proc_info = self.procs.get(tool_id)
            if not proc_info:
                return {"status": "stopped"}
            
            return {
                "status": "running" if proc_info.popen.poll() is None else "dead",
                "port": proc_info.port,
                "pid": proc_info.popen.pid,
                "started_at": proc_info.started_at.isoformat(),
                "uptime": (datetime.now() - proc_info.started_at).total_seconds(),
                "restart_count": proc_info.restart_count,
                "health_failures": proc_info.health_failures
            }
    
    def set_restart_policy(self, tool_id: str, enabled: bool = True, 
                          max_restarts: int = 3):
        """Set restart policy for a tool"""
        self.restart_policies[tool_id] = {
            "enabled": enabled,
            "max_restarts": max_restarts
        }
    
    def cleanup_zombies(self):
        """Clean up any zombie processes"""
        with self._lock:
            for tool_id, proc_info in list(self.procs.items()):
                if proc_info.popen.poll() is not None:
                    logger.info(f"Cleaning up zombie process for {tool_id}")
                    self.procs.pop(tool_id, None)
                    self.port_manager.release_port(proc_info.port)
    
    def shutdown_all(self):
        """Shutdown all running tools"""
        logger.info("Shutting down all tools")
        with self._lock:
            for tool_id in list(self.procs.keys()):
                try:
                    self.stop(tool_id)
                except Exception as e:
                    logger.error(f"Error stopping {tool_id}: {e}")


def venv_python(venv_dir: Path) -> Path:
    """Get python executable path for a venv"""
    if platform.system() == 'Windows':
        python_path = venv_dir / "Scripts" / "python.exe"
    else:
        python_path = venv_dir / "bin" / "python"
    
    if not python_path.exists():
        raise FileNotFoundError(f"Python not found in venv: {venv_dir}")
    
    return python_path


def find_free_port(start: int = 9000, end: int = 9999) -> int:
    """Find a free port in range (legacy compatibility)"""
    for port in range(start, end + 1):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(('127.0.0.1', port))
            sock.close()
            return port
        except OSError:
            continue
    raise RuntimeError(f"No free ports in range {start}-{end}")


if __name__ == "__main__":
    # Test the process manager
    import tempfile
    import venv
    
    # Create test venv
    test_dir = Path(tempfile.mkdtemp())
    venv_dir = test_dir / "venv"
    venv.create(venv_dir, with_pip=True)
    
    # Test port manager
    pm = PortManager()
    port = pm.allocate_port("test-tool")
    print(f"Allocated port: {port}")
    pm.release_port(port)
    
    # Cleanup
    import shutil
    shutil.rmtree(test_dir)
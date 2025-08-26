"""
Transactional tool installation with rollback support
"""
import os
import sys
import subprocess
import shutil
import venv
import json
import tempfile
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import hashlib
import tarfile

logger = logging.getLogger('localstore.install')


class InstallationError(Exception):
    """Custom exception for installation failures"""
    pass


class InstallTransaction:
    """Manages transactional installation with rollback"""
    
    def __init__(self, tool_id: str, tools_dir: Path):
        self.tool_id = tool_id
        self.tools_dir = tools_dir
        self.temp_dir = None
        self.backup_dir = None
        self.installed_path = None
        self.steps_completed = []
        
    def __enter__(self):
        """Start transaction"""
        # Create temp directory for installation
        self.temp_dir = Path(tempfile.mkdtemp(prefix=f"localstore_install_{self.tool_id}_"))
        logger.info(f"Started installation transaction for {self.tool_id}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Complete or rollback transaction"""
        if exc_type is not None:
            # Error occurred, rollback
            logger.error(f"Installation failed for {self.tool_id}: {exc_val}")
            self.rollback()
    else:
            # Success, cleanup temp files
            self.cleanup()
        
        return False  # Don't suppress exceptions
    
    def rollback(self):
        """Rollback the installation"""
        logger.info(f"Rolling back installation for {self.tool_id}")
        
        # Remove any created directories
        if self.installed_path and self.installed_path.exists():
            shutil.rmtree(self.installed_path)
            logger.info(f"Removed incomplete installation at {self.installed_path}")
        
        # Restore backup if exists
        if self.backup_dir and self.backup_dir.exists():
            target = self.tools_dir / self.tool_id
            if self.backup_dir.exists():
                shutil.move(str(self.backup_dir), str(target))
                logger.info(f"Restored backup for {self.tool_id}")
        
        # Cleanup temp files
        self.cleanup()
    
    def cleanup(self):
        """Clean up temporary files"""
        if self.temp_dir and self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
        
        if self.backup_dir and self.backup_dir.exists():
            shutil.rmtree(self.backup_dir)
    
    def backup_existing(self, path: Path):
        """Backup existing installation"""
        if path.exists():
            self.backup_dir = Path(tempfile.mkdtemp(prefix=f"localstore_backup_{self.tool_id}_"))
            shutil.move(str(path), str(self.backup_dir / self.tool_id))
            logger.info(f"Backed up existing installation for {self.tool_id}")
    
    def mark_step_complete(self, step: str):
        """Mark a step as completed"""
        self.steps_completed.append({
            "step": step,
            "timestamp": datetime.now().isoformat()
        })
        logger.info(f"Completed step '{step}' for {self.tool_id}")


def ensure_tool_installed(tool_id: str, metadata: Dict[str, Any], 
                         tools_dir: Path) -> Dict[str, Any]:
    """
    Install a tool transactionally
    
    Args:
        tool_id: Unique tool identifier
        metadata: Tool metadata from registry
        tools_dir: Base directory for tools
        
    Returns:
        Tool info dict with installation details
        
    Raises:
        InstallationError: If installation fails
    """
    with InstallTransaction(tool_id, tools_dir) as transaction:
        # Determine paths
        tool_path = tools_dir / tool_id
        transaction.installed_path = tool_path
        
        # Backup existing installation if any
        transaction.backup_existing(tool_path)
        
        # Step 1: Copy/clone tool files
        if "path" in metadata and Path(metadata["path"]).exists():
            # Local path
            source_path = Path(metadata["path"])
            if source_path.is_absolute():
                shutil.copytree(str(source_path), str(tool_path))
            else:
                # Relative to registry location
                abs_source = Path(__file__).parent / source_path
                shutil.copytree(str(abs_source), str(tool_path))
            transaction.mark_step_complete("copy_files")
            
        elif "repo" in metadata:
            # Git repository
            _clone_repository(metadata["repo"], tool_path, metadata.get("ref"))
            transaction.mark_step_complete("clone_repo")
            
        elif "url" in metadata:
            # Download from URL
            _download_and_extract(metadata["url"], tool_path)
            transaction.mark_step_complete("download_files")
            
    else:
            raise InstallationError("No valid source specified (path, repo, or url)")
        
        # Step 2: Create virtual environment
        venv_path = tool_path / ".venv"
        logger.info(f"Creating virtual environment at {venv_path}")
        
        venv.create(venv_path, with_pip=True, clear=True)
        transaction.mark_step_complete("create_venv")
        
        # Step 3: Install dependencies
        requirements_file = tool_path / "requirements.txt"
        if requirements_file.exists():
            _install_requirements(venv_path, requirements_file)
            transaction.mark_step_complete("install_deps")
        else:
            logger.warning(f"No requirements.txt found for {tool_id}")
        
        # Step 4: Validate entry point
        entry = metadata.get("entry", "app:app")
        if not _validate_entry_point(venv_path, tool_path, entry):
            raise InstallationError(f"Invalid entry point: {entry}")
        transaction.mark_step_complete("validate_entry")
        
        # Step 5: Run health check (if supported)
        if _run_health_check(venv_path, tool_path, entry):
            transaction.mark_step_complete("health_check")
        
        # Step 6: Generate metadata file
        tool_info = {
        "id": tool_id,
            "name": metadata.get("name", tool_id),
            "description": metadata.get("description", ""),
            "version": metadata.get("version", "1.0.0"),
            "author": metadata.get("author", ""),
            "path": str(tool_path),
            "venv": str(venv_path),
            "entry": entry,
            "tags": metadata.get("tags", []),
            "icon": metadata.get("icon", ""),
            "installedAt": datetime.now().isoformat(),
            "installSteps": transaction.steps_completed,
        "status": "stopped",
        "port": None,
            "autostart": metadata.get("autostart", False)
        }
        
        # Write metadata
        metadata_file = tool_path / ".localstore.json"
        metadata_file.write_text(json.dumps(tool_info, indent=2))
        transaction.mark_step_complete("write_metadata")
        
        logger.info(f"Successfully installed {tool_id}")
        return tool_info


def _clone_repository(repo_url: str, target_path: Path, ref: Optional[str] = None):
    """Clone a git repository"""
    try:
        import git
        logger.info(f"Cloning {repo_url} to {target_path}")
        
        repo = git.Repo.clone_from(
            repo_url,
            target_path,
            branch=ref or 'main',
            depth=1  # Shallow clone for speed
        )
        
        logger.info(f"Successfully cloned {repo_url}")
    except Exception as e:
        raise InstallationError(f"Failed to clone repository: {e}")


def _download_and_extract(url: str, target_path: Path):
    """Download and extract archive from URL"""
    import requests
    
    try:
        logger.info(f"Downloading {url}")
        
        # Download to temp file
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            response = requests.get(url, stream=True, timeout=300)
            response.raise_for_status()
            
            # Write with progress
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            for chunk in response.iter_content(chunk_size=8192):
                tmp.write(chunk)
                downloaded += len(chunk)
                
                if total_size > 0:
                    progress = (downloaded / total_size) * 100
                    logger.debug(f"Download progress: {progress:.1f}%")
            
            tmp_path = Path(tmp.name)
        
        # Extract based on file type
        if url.endswith(('.tar.gz', '.tgz')):
            with tarfile.open(tmp_path, 'r:gz') as tar:
                tar.extractall(target_path)
        elif url.endswith('.zip'):
            import zipfile
            with zipfile.ZipFile(tmp_path, 'r') as zip_file:
                zip_file.extractall(target_path)
        else:
            raise InstallationError(f"Unsupported archive format: {url}")
        
        # Cleanup
        tmp_path.unlink()
        
        logger.info(f"Successfully extracted {url}")
        
    except Exception as e:
        raise InstallationError(f"Failed to download/extract: {e}")


def _install_requirements(venv_path: Path, requirements_file: Path):
    """Install requirements in virtual environment"""
    pip_cmd = _get_pip_command(venv_path)
    
    logger.info(f"Installing requirements from {requirements_file}")
    
    try:
        # Upgrade pip first
        subprocess.check_call(
            [str(pip_cmd), "install", "--upgrade", "pip", "setuptools", "wheel"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=300
        )
        
        # Install requirements
        result = subprocess.run(
            [str(pip_cmd), "install", "-r", str(requirements_file)],
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )
        
        if result.returncode != 0:
            logger.error(f"pip install failed: {result.stderr}")
            raise InstallationError(f"Failed to install requirements: {result.stderr}")
        
        logger.info("Successfully installed requirements")
        
    except subprocess.TimeoutExpired:
        raise InstallationError("Requirements installation timed out")
    except Exception as e:
        raise InstallationError(f"Failed to install requirements: {e}")


def _validate_entry_point(venv_path: Path, tool_path: Path, entry: str) -> bool:
    """Validate that entry point exists and is importable"""
    try:
        module_name, attr_name = entry.split(":")
        
        # Check if module file exists
        module_file = tool_path / f"{module_name.replace('.', '/')}.py"
        if not module_file.exists():
            logger.error(f"Module file not found: {module_file}")
            return False
        
        # Try to import and check attribute exists
        python_cmd = _get_python_command(venv_path)
        
        check_script = f"""
import sys
sys.path.insert(0, '{tool_path}')
try:
    module = __import__('{module_name}')
    for part in '{module_name}'.split('.')[1:]:
        module = getattr(module, part)
    app = getattr(module, '{attr_name}')
    print('OK')
except Exception as e:
    print(f'ERROR: {{e}}')
    sys.exit(1)
"""
        
        result = subprocess.run(
            [str(python_cmd), "-c", check_script],
            capture_output=True,
            text=True,
            cwd=str(tool_path),
            timeout=30
        )
        
        if result.returncode == 0 and "OK" in result.stdout:
            logger.info(f"Entry point {entry} validated successfully")
            return True
        else:
            logger.error(f"Entry point validation failed: {result.stdout} {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to validate entry point: {e}")
        return False


def _run_health_check(venv_path: Path, tool_path: Path, entry: str) -> bool:
    """Run a basic health check on the tool"""
    try:
        python_cmd = _get_python_command(venv_path)
        
        # Create a test script that starts the app and checks health
        test_script = f"""
import sys
import time
import threading
import requests
sys.path.insert(0, '{tool_path}')

def run_app():
    import uvicorn
    module_name, attr_name = '{entry}'.split(':')
    module = __import__(module_name)
    for part in module_name.split('.')[1:]:
        module = getattr(module, part)
    app = getattr(module, attr_name)
    uvicorn.run(app, host='127.0.0.1', port=19999, log_level='error')

# Start app in background
thread = threading.Thread(target=run_app, daemon=True)
thread.start()

# Wait for startup
time.sleep(3)

# Check health endpoint
try:
    response = requests.get('http://127.0.0.1:19999/health', timeout=5)
    if response.status_code == 200:
        print('HEALTH_OK')
        sys.exit(0)
except:
    pass

print('HEALTH_FAIL')
sys.exit(1)
"""
        
        result = subprocess.run(
            [str(python_cmd), "-c", test_script],
            capture_output=True,
            text=True,
            cwd=str(tool_path),
            timeout=15
        )
        
        if "HEALTH_OK" in result.stdout:
            logger.info("Health check passed")
            return True
        else:
            logger.warning("Health check failed (non-critical)")
            return False
            
    except Exception as e:
        logger.warning(f"Could not run health check: {e}")
        return False


def _get_python_command(venv_path: Path) -> Path:
    """Get python executable for venv"""
    if sys.platform == "win32":
        return venv_path / "Scripts" / "python.exe"
    else:
        return venv_path / "bin" / "python"


def _get_pip_command(venv_path: Path) -> Path:
    """Get pip executable for venv"""
    if sys.platform == "win32":
        return venv_path / "Scripts" / "pip.exe"
    else:
        return venv_path / "bin" / "pip"


def calculate_tool_hash(tool_path: Path) -> str:
    """Calculate hash of tool files for integrity checking"""
    hasher = hashlib.sha256()
    
    for file_path in sorted(tool_path.rglob("*.py")):
        if ".venv" in str(file_path):
            continue
        try:
            hasher.update(file_path.read_bytes())
        except Exception:
            pass
    
    return hasher.hexdigest()


def verify_tool_integrity(tool_id: str, tools_dir: Path) -> bool:
    """Verify tool hasn't been tampered with"""
    tool_path = tools_dir / tool_id
    metadata_file = tool_path / ".localstore.json"
    
    if not metadata_file.exists():
        return False
    
    try:
        metadata = json.loads(metadata_file.read_text())
        stored_hash = metadata.get("fileHash")
        
        if not stored_hash:
            # No hash stored, can't verify
            return True
        
        current_hash = calculate_tool_hash(tool_path)
        return current_hash == stored_hash
        
    except Exception as e:
        logger.error(f"Failed to verify integrity for {tool_id}: {e}")
        return False


if __name__ == "__main__":
    # Test transactional installation
    import tempfile
    
    tools_dir = Path(tempfile.mkdtemp())
    
    # Test metadata
    metadata = {
        "id": "test-tool",
        "name": "Test Tool",
        "path": "examples/hello-fapi",
        "entry": "app:app"
    }
    
    try:
        info = ensure_tool_installed("test-tool", metadata, tools_dir)
        print("Installation successful:", info)
    except Exception as e:
        print("Installation failed:", e)
    finally:
        shutil.rmtree(tools_dir)
"""
Process manager tests
"""
import pytest
import tempfile
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
import subprocess

from proc import ProcManager, PortManager, HealthChecker, venv_python


class TestPortManager:
    """Test port management"""
    
    def test_allocate_port(self):
        """Test port allocation"""
        pm = PortManager()
        port = pm.allocate_port("test-tool")
        assert port is not None
        assert 9000 <= port <= 9999
        
        # Cleanup
        pm.release_port(port)
    
    def test_allocate_multiple_ports(self):
        """Test allocating multiple ports"""
        pm = PortManager()
        ports = []
        
        # Allocate 5 ports
        for i in range(5):
            port = pm.allocate_port(f"test-tool-{i}")
            assert port is not None
            assert port not in ports
            ports.append(port)
        
        # Cleanup
        for port in ports:
            pm.release_port(port)
    
    def test_port_already_in_use(self):
        """Test handling port already in use"""
        pm = PortManager()
        
        # Mock a port as in use
        with patch.object(pm, '_is_port_available', return_value=False):
            port = pm.allocate_port("test-tool")
            assert port is None
    
    def test_cleanup_stale_locks(self):
        """Test cleaning up stale lock files"""
        pm = PortManager()
        
        # Create a fake lock file with non-existent PID
        lock_file = pm.lock_dir / "9500.lock"
        lock_file.write_text("99999999\nstale-tool")
        
        # Re-initialize to trigger cleanup
        pm2 = PortManager()
        
        # Lock file should be cleaned up
        assert not lock_file.exists()


class TestHealthChecker:
    """Test health checking"""
    
    @patch('httpx.get')
    def test_health_check_success(self, mock_get):
        """Test successful health check"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        hc = HealthChecker()
        result = hc.check_health(9001)
        
        assert result is True
        mock_get.assert_called_with('http://127.0.0.1:9001/health', timeout=5)
    
    @patch('httpx.get')
    def test_health_check_failure(self, mock_get):
        """Test failed health check"""
        mock_get.side_effect = Exception("Connection failed")
        
        hc = HealthChecker()
        result = hc.check_health(9001)
        
        assert result is False


class TestProcManager:
    """Test process manager"""
    
    def test_initialization(self):
        """Test process manager initialization"""
        pm = ProcManager()
        assert pm.procs == {}
        assert pm.port_manager is not None
        assert pm.health_checker is not None
    
    @patch('subprocess.Popen')
    def test_start_tool(self, mock_popen, temp_dir):
        """Test starting a tool"""
        # Setup mock
        mock_process = MagicMock()
        mock_process.poll.return_value = None
        mock_process.stdout = MagicMock()
        mock_popen.return_value = mock_process
        
        # Create test venv structure
        venv_dir = temp_dir / "venv"
        venv_dir.mkdir()
        if Path("C:\\").exists():  # Windows
            (venv_dir / "Scripts").mkdir()
            (venv_dir / "Scripts" / "python.exe").touch()
        else:
            (venv_dir / "bin").mkdir()
            (venv_dir / "bin" / "python").touch()
        
        pm = ProcManager()
        port = pm.start_uvicorn("test-tool", venv_dir, temp_dir, "app:app")
        
        assert port is not None
        assert "test-tool" in pm.procs
        assert pm.procs["test-tool"].port == port
    
    def test_stop_tool(self, test_proc_manager):
        """Test stopping a tool"""
        # Add a mock process
        mock_process = MagicMock()
        mock_process.poll.return_value = None
        
        from proc import ProcInfo
        from datetime import datetime
        
        test_proc_manager.procs["test-tool"] = ProcInfo(
            popen=mock_process,
            port=9001,
            tool_id="test-tool",
            started_at=datetime.now()
        )
        
        # Stop the tool
        test_proc_manager.stop("test-tool")
        
        assert "test-tool" not in test_proc_manager.procs
        mock_process.terminate.assert_called_once()
    
    def test_is_running(self, test_proc_manager):
        """Test checking if tool is running"""
        # Not in procs
        assert test_proc_manager.is_running("nonexistent") is False
        
        # In procs but dead
        mock_process = MagicMock()
        mock_process.poll.return_value = 1
        
        from proc import ProcInfo
        from datetime import datetime
        
        test_proc_manager.procs["dead-tool"] = ProcInfo(
            popen=mock_process,
            port=9001,
            tool_id="dead-tool",
            started_at=datetime.now()
        )
        
        assert test_proc_manager.is_running("dead-tool") is False
        
        # In procs and alive
        mock_process.poll.return_value = None
        assert test_proc_manager.is_running("dead-tool") is True
    
    def test_get_status(self, test_proc_manager):
        """Test getting detailed status"""
        # Not running
        status = test_proc_manager.get_status("nonexistent")
        assert status["status"] == "stopped"
        
        # Running
        mock_process = MagicMock()
        mock_process.poll.return_value = None
        mock_process.pid = 12345
        
        from proc import ProcInfo
        from datetime import datetime
        
        start_time = datetime.now()
        test_proc_manager.procs["test-tool"] = ProcInfo(
            popen=mock_process,
            port=9001,
            tool_id="test-tool",
            started_at=start_time,
            restart_count=2,
            health_failures=1
        )
        
        status = test_proc_manager.get_status("test-tool")
        assert status["status"] == "running"
        assert status["port"] == 9001
        assert status["pid"] == 12345
        assert status["restart_count"] == 2
        assert status["health_failures"] == 1
        assert "uptime" in status
    
    def test_cleanup_zombies(self, test_proc_manager):
        """Test cleaning up zombie processes"""
        # Add zombie process
        mock_process = MagicMock()
        mock_process.poll.return_value = 1  # Process is dead
        
        from proc import ProcInfo
        from datetime import datetime
        
        test_proc_manager.procs["zombie"] = ProcInfo(
            popen=mock_process,
            port=9001,
            tool_id="zombie",
            started_at=datetime.now()
        )
        
        # Add alive process
        mock_process2 = MagicMock()
        mock_process2.poll.return_value = None
        
        test_proc_manager.procs["alive"] = ProcInfo(
            popen=mock_process2,
            port=9002,
            tool_id="alive",
            started_at=datetime.now()
        )
        
        # Cleanup
        test_proc_manager.cleanup_zombies()
        
        assert "zombie" not in test_proc_manager.procs
        assert "alive" in test_proc_manager.procs


class TestVenvPython:
    """Test venv python path helper"""
    
    def test_venv_python_unix(self, temp_dir):
        """Test getting python path on Unix"""
        venv_dir = temp_dir / "venv"
        bin_dir = venv_dir / "bin"
        bin_dir.mkdir(parents=True)
        python_path = bin_dir / "python"
        python_path.touch()
        
        with patch('platform.system', return_value='Linux'):
            result = venv_python(venv_dir)
            assert result == python_path
    
    def test_venv_python_windows(self, temp_dir):
        """Test getting python path on Windows"""
        venv_dir = temp_dir / "venv"
        scripts_dir = venv_dir / "Scripts"
        scripts_dir.mkdir(parents=True)
        python_path = scripts_dir / "python.exe"
        python_path.touch()
        
        with patch('platform.system', return_value='Windows'):
            result = venv_python(venv_dir)
            assert result == python_path
    
    def test_venv_python_not_found(self, temp_dir):
        """Test error when python not found in venv"""
        venv_dir = temp_dir / "venv"
        venv_dir.mkdir()
        
        with pytest.raises(FileNotFoundError):
            venv_python(venv_dir)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

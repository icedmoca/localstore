"""
Installation process tests
"""
import pytest
import json
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock, call
import subprocess

from install import (
    InstallTransaction, ensure_tool_installed, InstallationError,
    calculate_tool_hash, verify_tool_integrity
)


class TestInstallTransaction:
    """Test transactional installation"""
    
    def test_transaction_success(self, temp_dir):
        """Test successful transaction"""
        with InstallTransaction("test-tool", temp_dir) as transaction:
            assert transaction.temp_dir.exists()
            transaction.mark_step_complete("test_step")
            assert len(transaction.steps_completed) == 1
        
        # After success, temp dir should be cleaned up
        assert not transaction.temp_dir.exists()
    
    def test_transaction_rollback(self, temp_dir):
        """Test transaction rollback on error"""
        try:
            with InstallTransaction("test-tool", temp_dir) as transaction:
                # Create installation directory
                tool_path = temp_dir / "test-tool"
                tool_path.mkdir()
                transaction.installed_path = tool_path
                
                # Simulate error
                raise InstallationError("Test error")
        except InstallationError:
            pass
        
        # Installation should be rolled back
        assert not tool_path.exists()
    
    def test_transaction_backup_restore(self, temp_dir):
        """Test backup and restore on rollback"""
        # Create existing installation
        existing_path = temp_dir / "test-tool"
        existing_path.mkdir()
        (existing_path / "existing.txt").write_text("existing content")
        
        try:
            with InstallTransaction("test-tool", temp_dir) as transaction:
                transaction.backup_existing(existing_path)
                
                # Existing should be moved
                assert not existing_path.exists()
                
                # Create new installation
                existing_path.mkdir()
                (existing_path / "new.txt").write_text("new content")
                transaction.installed_path = existing_path
                
                # Simulate error
                raise InstallationError("Test error")
        except InstallationError:
            pass
        
        # Original should be restored
        assert existing_path.exists()
        assert (existing_path / "existing.txt").exists()
        assert not (existing_path / "new.txt").exists()


class TestEnsureToolInstalled:
    """Test tool installation process"""
    
    def test_install_from_local_path(self, temp_dir):
        """Test installing from local path"""
        # Create source tool
        source_dir = temp_dir / "source"
        source_dir.mkdir()
        (source_dir / "app.py").write_text("print('test')")
        (source_dir / "requirements.txt").write_text("fastapi==0.104.1")
        
        metadata = {
            "path": str(source_dir),
            "entry": "app:app"
        }
        
        with patch('install._validate_entry_point', return_value=True):
            info = ensure_tool_installed("test-tool", metadata, temp_dir)
        
        # Check installation
        assert info["id"] == "test-tool"
        assert Path(info["path"]).exists()
        assert Path(info["venv"]).exists()
        assert (Path(info["path"]) / "app.py").exists()
    
    @patch('install._clone_repository')
    def test_install_from_git(self, mock_clone, temp_dir):
        """Test installing from git repository"""
        metadata = {
            "repo": "https://github.com/test/repo.git",
            "ref": "main",
            "entry": "app:app"
        }
        
        # Mock clone to create files
        def create_repo(url, path, ref):
            path.mkdir(parents=True)
            (path / "app.py").write_text("print('test')")
            (path / "requirements.txt").write_text("")
        
        mock_clone.side_effect = create_repo
        
        with patch('install._validate_entry_point', return_value=True):
            info = ensure_tool_installed("test-tool", metadata, temp_dir)
        
        assert info["id"] == "test-tool"
        mock_clone.assert_called_once()
    
    def test_install_no_source(self, temp_dir):
        """Test error when no source specified"""
        metadata = {"entry": "app:app"}
        
        with pytest.raises(InstallationError) as exc_info:
            ensure_tool_installed("test-tool", metadata, temp_dir)
        
        assert "No valid source" in str(exc_info.value)
    
    @patch('subprocess.check_call')
    def test_install_requirements(self, mock_check_call, temp_dir):
        """Test requirements installation"""
        # Create tool with requirements
        source_dir = temp_dir / "source"
        source_dir.mkdir()
        (source_dir / "app.py").write_text("print('test')")
        (source_dir / "requirements.txt").write_text("fastapi==0.104.1\nuvicorn==0.24.0")
        
        metadata = {
            "path": str(source_dir),
            "entry": "app:app"
        }
        
        with patch('install._validate_entry_point', return_value=True):
            info = ensure_tool_installed("test-tool", metadata, temp_dir)
        
        # Check pip was called
        assert mock_check_call.call_count >= 2  # upgrade pip + install requirements
    
    def test_install_invalid_entry_point(self, temp_dir):
        """Test error with invalid entry point"""
        source_dir = temp_dir / "source"
        source_dir.mkdir()
        (source_dir / "app.py").write_text("print('test')")
        
        metadata = {
            "path": str(source_dir),
            "entry": "nonexistent:app"
        }
        
        with patch('install._validate_entry_point', return_value=False):
            with pytest.raises(InstallationError) as exc_info:
                ensure_tool_installed("test-tool", metadata, temp_dir)
            
            assert "Invalid entry point" in str(exc_info.value)


class TestValidateEntryPoint:
    """Test entry point validation"""
    
    def test_validate_valid_entry_point(self, temp_dir):
        """Test validating valid entry point"""
        # Create tool
        tool_path = temp_dir / "tool"
        tool_path.mkdir()
        (tool_path / "app.py").write_text("app = 'test'")
        
        # Create mock venv
        venv_path = temp_dir / "venv"
        venv_path.mkdir()
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value.returncode = 0
            mock_run.return_value.stdout = "OK"
            
            from install import _validate_entry_point
            result = _validate_entry_point(venv_path, tool_path, "app:app")
            
            assert result is True
    
    def test_validate_missing_module(self, temp_dir):
        """Test validating missing module"""
        tool_path = temp_dir / "tool"
        tool_path.mkdir()
        venv_path = temp_dir / "venv"
        venv_path.mkdir()
        
        from install import _validate_entry_point
        result = _validate_entry_point(venv_path, tool_path, "missing:app")
        
        assert result is False


class TestIntegrityChecking:
    """Test tool integrity verification"""
    
    def test_calculate_hash(self, temp_dir):
        """Test calculating tool hash"""
        tool_path = temp_dir / "tool"
        tool_path.mkdir()
        (tool_path / "app.py").write_text("print('test')")
        (tool_path / "utils.py").write_text("def helper(): pass")
        
        hash1 = calculate_tool_hash(tool_path)
        assert len(hash1) == 64  # SHA256 hex length
        
        # Same content should give same hash
        hash2 = calculate_tool_hash(tool_path)
        assert hash1 == hash2
        
        # Modified content should give different hash
        (tool_path / "app.py").write_text("print('modified')")
        hash3 = calculate_tool_hash(tool_path)
        assert hash1 != hash3
    
    def test_verify_integrity(self, temp_dir):
        """Test verifying tool integrity"""
        tool_path = temp_dir / "test-tool"
        tool_path.mkdir()
        (tool_path / "app.py").write_text("print('test')")
        
        # Calculate hash
        file_hash = calculate_tool_hash(tool_path)
        
        # Create metadata with hash
        metadata = {
            "id": "test-tool",
            "fileHash": file_hash
        }
        metadata_file = tool_path / ".localstore.json"
        metadata_file.write_text(json.dumps(metadata))
        
        # Should verify successfully
        assert verify_tool_integrity("test-tool", temp_dir) is True
        
        # Modify file
        (tool_path / "app.py").write_text("print('modified')")
        
        # Should fail verification
        assert verify_tool_integrity("test-tool", temp_dir) is False


class TestHealthCheck:
    """Test health check functionality"""
    
    @patch('subprocess.run')
    def test_health_check_success(self, mock_run, temp_dir):
        """Test successful health check"""
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "HEALTH_OK"
        
        from install import _run_health_check
        result = _run_health_check(temp_dir, temp_dir, "app:app")
        
        assert result is True
    
    @patch('subprocess.run')
    def test_health_check_failure(self, mock_run, temp_dir):
        """Test failed health check"""
        mock_run.return_value.returncode = 1
        mock_run.return_value.stdout = "HEALTH_FAIL"
        
        from install import _run_health_check
        result = _run_health_check(temp_dir, temp_dir, "app:app")
        
        assert result is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

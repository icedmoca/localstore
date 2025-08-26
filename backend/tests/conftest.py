"""
Pytest configuration and fixtures for LocalStore tests
"""
import pytest
import tempfile
import shutil
from pathlib import Path
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import app
from state_json import AtomicJSONState
from proc import ProcManager


@pytest.fixture
def client():
    """Create test client for Flask app"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def temp_dir():
    """Create temporary directory for tests"""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path)


@pytest.fixture
def test_state(temp_dir):
    """Create test state"""
    state_path = temp_dir / "test_state.json"
    return AtomicJSONState(state_path)


@pytest.fixture
def test_proc_manager():
    """Create test process manager"""
    pm = ProcManager()
    yield pm
    # Cleanup any running processes
    pm.shutdown_all()


@pytest.fixture
def sample_tool_metadata():
    """Sample tool metadata for testing"""
    return {
        "id": "test-tool",
        "name": "Test Tool",
        "description": "A tool for testing",
        "version": "1.0.0",
        "author": "Test Author",
        "path": "test/path",
        "entry": "app:app",
        "tags": ["test", "sample"]
    }


@pytest.fixture
def mock_registry(temp_dir, sample_tool_metadata):
    """Create mock registry file"""
    registry_path = temp_dir / "registry.json"
    import json
    registry_path.write_text(json.dumps([sample_tool_metadata]))
    return registry_path

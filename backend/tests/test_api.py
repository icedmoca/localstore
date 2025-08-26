"""
API endpoint tests for LocalStore
"""
import pytest
import json
from unittest.mock import patch, MagicMock


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self, client):
        """Test /api/health returns OK"""
        response = client.get('/api/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] is True
        assert 'version' in data
        assert 'timestamp' in data


class TestRegistryEndpoint:
    """Test registry endpoints"""
    
    def test_get_registry_empty(self, client):
        """Test empty registry returns empty list"""
        with patch('app.REGISTRY_PATH') as mock_path:
            mock_path.exists.return_value = False
            response = client.get('/api/registry')
            assert response.status_code == 200
            assert json.loads(response.data) == []
    
    def test_get_registry_with_tools(self, client, mock_registry):
        """Test registry with tools"""
        with patch('app.REGISTRY_PATH', mock_registry):
            response = client.get('/api/registry')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert len(data) == 1
            assert data[0]['id'] == 'test-tool'


class TestToolsEndpoint:
    """Test tools listing and management"""
    
    def test_list_tools_empty(self, client, test_state):
        """Test listing tools when none installed"""
        with patch('app.state', test_state):
            response = client.get('/api/tools')
            assert response.status_code == 200
            assert json.loads(response.data) == []
    
    def test_list_tools_with_installed(self, client, test_state):
        """Test listing installed tools"""
        # Add a tool to state
        test_state.upsert({
            'id': 'test-tool',
            'name': 'Test Tool',
            'status': 'stopped',
            'port': None,
            'path': '/test/path',
            'venv': '/test/venv',
            'entry': 'app:app'
        })
        
        with patch('app.state', test_state):
            response = client.get('/api/tools')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert len(data) == 1
            assert data[0]['id'] == 'test-tool'
            assert data[0]['status'] == 'stopped'


class TestInstallEndpoint:
    """Test tool installation"""
    
    def test_install_missing_id(self, client):
        """Test install without tool ID"""
        response = client.post('/api/tools/install',
                             json={})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_install_tool_not_in_registry(self, client, mock_registry):
        """Test installing tool not in registry"""
        with patch('app.REGISTRY_PATH', mock_registry):
            response = client.post('/api/tools/install',
                                 json={'id': 'nonexistent'})
            assert response.status_code == 404
            data = json.loads(response.data)
            assert 'error' in data
    
    @patch('app.ensure_tool_installed')
    def test_install_success(self, mock_install, client, mock_registry, test_state):
        """Test successful tool installation"""
        mock_install.return_value = {
            'id': 'test-tool',
            'name': 'Test Tool',
            'status': 'stopped',
            'path': '/test/path',
            'venv': '/test/venv',
            'entry': 'app:app'
        }
        
        with patch('app.REGISTRY_PATH', mock_registry):
            with patch('app.state', test_state):
                response = client.post('/api/tools/install',
                                     json={'id': 'test-tool'})
                assert response.status_code == 200
                data = json.loads(response.data)
                assert data['id'] == 'test-tool'


class TestToolControl:
    """Test tool start/stop/restart"""
    
    def test_start_nonexistent_tool(self, client, test_state):
        """Test starting non-existent tool"""
        with patch('app.state', test_state):
            response = client.post('/api/tools/nonexistent/start')
            assert response.status_code == 404
    
    @patch('app.runtime')
    def test_start_tool(self, mock_runtime, client, test_state):
        """Test starting a tool"""
        # Setup
        test_state.upsert({
            'id': 'test-tool',
            'name': 'Test Tool',
            'status': 'stopped',
            'path': '/test/path',
            'venv': '/test/venv',
            'entry': 'app:app'
        })
        mock_runtime.is_running.return_value = False
        mock_runtime.start_uvicorn.return_value = 9001
        
        with patch('app.state', test_state):
            response = client.post('/api/tools/test-tool/start')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['status'] == 'running'
            assert data['port'] == 9001
    
    @patch('app.runtime')
    def test_stop_tool(self, mock_runtime, client, test_state):
        """Test stopping a tool"""
        # Setup
        test_state.upsert({
            'id': 'test-tool',
            'name': 'Test Tool',
            'status': 'running',
            'port': 9001,
            'path': '/test/path',
            'venv': '/test/venv',
            'entry': 'app:app'
        })
        
        with patch('app.state', test_state):
            response = client.post('/api/tools/test-tool/stop')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['status'] == 'stopped'
            assert data['port'] is None


class TestFileOperations:
    """Test file operation endpoints"""
    
    def test_list_files_nonexistent_tool(self, client, test_state):
        """Test listing files for non-existent tool"""
        with patch('app.state', test_state):
            response = client.get('/api/tools/nonexistent/files')
            assert response.status_code == 404
    
    def test_read_file_missing_path(self, client, test_state):
        """Test reading file without path parameter"""
        test_state.upsert({
            'id': 'test-tool',
            'path': '/test/path',
            'venv': '/test/venv',
            'entry': 'app:app'
        })
        
        with patch('app.state', test_state):
            response = client.get('/api/tools/test-tool/file')
            assert response.status_code == 400
    
    def test_write_file_path_traversal(self, client, test_state, temp_dir):
        """Test path traversal protection"""
        test_state.upsert({
            'id': 'test-tool',
            'path': str(temp_dir / 'tool'),
            'venv': '/test/venv',
            'entry': 'app:app'
        })
        
        with patch('app.state', test_state):
            response = client.post('/api/tools/test-tool/file',
                                 json={
                                     'path': '../../../etc/passwd',
                                     'content': 'hacked'
                                 })
            assert response.status_code == 400


class TestRateLimiting:
    """Test rate limiting"""
    
    @patch('app.rate_limiter')
    def test_rate_limit_exceeded(self, mock_limiter, client):
        """Test rate limit response"""
        mock_limiter.check_rate_limit.return_value = False
        
        response = client.post('/api/tools/install', json={'id': 'test'})
        assert response.status_code == 429
        data = json.loads(response.data)
        assert 'error' in data
        assert 'rate limit' in data['error'].lower()


class TestSecurity:
    """Test security features"""
    
    def test_api_key_required(self, client):
        """Test API key authentication when enabled"""
        with patch.dict('os.environ', {'LOCALSTORE_API_KEY': 'test-key'}):
            # Recreate app to pick up env var
            from app import app as test_app
            test_client = test_app.test_client()
            
            # Without auth header
            response = test_client.get('/api/health')
            assert response.status_code == 401
            
            # With correct auth header
            response = test_client.get('/api/health',
                                     headers={'Authorization': 'Bearer test-key'})
            assert response.status_code == 200
    
    def test_security_headers(self, client):
        """Test security headers are applied"""
        response = client.get('/api/health')
        assert 'X-Content-Type-Options' in response.headers
        assert 'X-Frame-Options' in response.headers
        assert 'Content-Security-Policy' in response.headers


class TestErrorHandling:
    """Test error handling"""
    
    def test_404_error(self, client):
        """Test 404 error response"""
        response = client.get('/api/nonexistent')
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'error' in data
    
    @patch('app.state.list_installed')
    def test_500_error(self, mock_list, client):
        """Test 500 error response"""
        mock_list.side_effect = Exception("Test error")
        
        response = client.get('/api/tools')
        assert response.status_code == 500
        data = json.loads(response.data)
        assert 'error' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

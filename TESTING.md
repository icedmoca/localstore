# LocalStore Testing Guide

## Overview

LocalStore includes a comprehensive test suite covering unit tests, integration tests, end-to-end tests, and smoke tests to ensure production readiness.

## Test Structure

```
localstore/
├── backend/
│   └── tests/           # Python backend tests
│       ├── conftest.py  # pytest fixtures
│       ├── test_api.py  # API endpoint tests
│       ├── test_proc.py # Process manager tests
│       └── test_install.py # Installation tests
├── frontend/
│   ├── src/__tests__/   # React component tests
│   └── tests/e2e/       # Playwright E2E tests
└── smoke_test.sh        # Production smoke test
```

## Running Tests

### Backend Tests (Python)

```bash
# Run all backend tests
cd backend
source venv/bin/activate
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_api.py

# Run specific test
pytest tests/test_api.py::TestHealthEndpoint::test_health_check

# Run with verbose output
pytest -v

# Run in parallel
pytest -n auto
```

### Frontend Tests (TypeScript)

```bash
# Run unit tests
cd frontend
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run with UI
npm run test:ui
```

### End-to-End Tests

```bash
# Install Playwright browsers (first time)
cd frontend
npx playwright install

# Run E2E tests
npm run e2e

# Run in headed mode (see browser)
npm run e2e -- --headed

# Run specific test file
npm run e2e -- tests/e2e/install.spec.ts

# Run with UI mode
npm run e2e -- --ui
```

### Smoke Test

```bash
# Run comprehensive smoke test
./smoke_test.sh

# This will:
# - Check prerequisites
# - Start backend
# - Test all API endpoints
# - Install a test tool
# - Test tool lifecycle
# - Verify file operations
# - Clean up
```

## Test Categories

### Unit Tests

**Backend (`backend/tests/test_*.py`)**
- API endpoint behavior
- Process management logic
- Installation transactions
- Security features
- Error handling

**Frontend (`frontend/src/__tests__/`)**
- React component rendering
- Store state management
- Hooks behavior
- Utility functions

### Integration Tests

**Backend**
- Tool installation flow
- Process lifecycle management
- File system operations
- State persistence

**Frontend**
- API integration
- State synchronization
- Router navigation

### End-to-End Tests

**Playwright (`frontend/tests/e2e/`)**
- Complete user workflows
- Tool installation and management
- Development mode features
- Error scenarios
- Performance testing
- Responsive design

### Smoke Tests

**Production Readiness (`smoke_test.sh`)**
- System prerequisites
- Backend startup
- API availability
- Tool operations
- Production build

## Writing Tests

### Backend Test Example

```python
# backend/tests/test_example.py
import pytest
from unittest.mock import patch

class TestFeature:
    def test_success_case(self, client, test_state):
        """Test successful operation"""
        response = client.get('/api/endpoint')
        assert response.status_code == 200
        
    def test_error_case(self, client):
        """Test error handling"""
        response = client.post('/api/endpoint', json={})
        assert response.status_code == 400
```

### Frontend Test Example

```typescript
// frontend/src/__tests__/Component.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from '../Component';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
  
  it('should handle click', () => {
    const onClick = jest.fn();
    render(<Component onClick={onClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### E2E Test Example

```typescript
// frontend/tests/e2e/feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test('should complete workflow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Interact with page
    await page.click('text=Button');
    
    // Assert results
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

## Test Coverage

### Minimum Coverage Requirements

- **Backend**: 80% coverage
- **Frontend**: 70% coverage
- **Critical paths**: 100% coverage

### Viewing Coverage Reports

```bash
# Backend HTML report
cd backend
pytest --cov=. --cov-report=html
open htmlcov/index.html

# Frontend coverage
cd frontend
npm test -- --coverage
# Report in coverage/lcov-report/index.html
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: |
          cd backend
          python -m venv venv
          source venv/bin/activate
          pip install -r requirements.txt
          pytest
  
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: |
          cd frontend
          npm ci
          npm test
          npm run e2e
```

## Testing Best Practices

1. **Isolation**: Each test should be independent
2. **Fixtures**: Use fixtures for common setup
3. **Mocking**: Mock external dependencies
4. **Assertions**: Be specific in assertions
5. **Naming**: Use descriptive test names
6. **Speed**: Keep tests fast
7. **Deterministic**: Avoid flaky tests

## Debugging Tests

### Backend Debugging

```bash
# Run with debugger
pytest --pdb

# Run with print statements visible
pytest -s

# Run with full traceback
pytest --tb=long
```

### Frontend Debugging

```bash
# Debug in VS Code
# Add breakpoint in test
# Run: Debug > JavaScript Debug Terminal
# Execute: npm test

# Debug E2E tests
npm run e2e -- --debug
```

## Performance Testing

### Load Testing

```python
# backend/tests/test_performance.py
import asyncio
import httpx

async def test_concurrent_requests():
    """Test handling concurrent requests"""
    async with httpx.AsyncClient() as client:
        tasks = [
            client.get('http://localhost:8000/api/health')
            for _ in range(100)
        ]
        responses = await asyncio.gather(*tasks)
        assert all(r.status_code == 200 for r in responses)
```

### Frontend Performance

```typescript
// Measure render performance
test('should render quickly', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    return JSON.stringify(window.performance.timing);
  });
  
  const timing = JSON.parse(metrics);
  const loadTime = timing.loadEventEnd - timing.navigationStart;
  expect(loadTime).toBeLessThan(1000);
});
```

## Security Testing

### Backend Security

```python
def test_sql_injection_protection(client):
    """Test SQL injection protection"""
    response = client.get('/api/tools', 
                         params={'id': "'; DROP TABLE tools; --"})
    assert response.status_code in [200, 400]
    # Should not crash

def test_path_traversal_protection(client):
    """Test path traversal protection"""
    response = client.get('/api/tools/test/file',
                         params={'path': '../../../etc/passwd'})
    assert response.status_code == 400
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Kill processes on ports 3000/8000
2. **Permission errors**: Check file permissions
3. **Module not found**: Activate virtualenv
4. **Timeout errors**: Increase test timeouts
5. **Flaky tests**: Add waits or retries

### Test Utilities

```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>

# Clean test artifacts
rm -rf backend/htmlcov
rm -rf frontend/coverage
rm -rf frontend/test-results
```

## Contributing Tests

When adding new features:

1. Write tests first (TDD)
2. Ensure all tests pass
3. Add edge cases
4. Update documentation
5. Check coverage

## Test Checklist

Before merging:

- [ ] All tests pass locally
- [ ] Coverage meets requirements
- [ ] No console.log/print statements
- [ ] Tests are deterministic
- [ ] Performance tests pass
- [ ] Security tests pass
- [ ] E2E tests cover feature
- [ ] Smoke test passes

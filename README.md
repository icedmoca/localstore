# LocalStore

<div align="center">
  <h3>Self-Hosted Python Tool Marketplace & IDE</h3>
  <p>Transform any Python package into a one-click web application</p>
  
  ![Python](https://img.shields.io/badge/Python-3.11+-blue)
  ![React](https://img.shields.io/badge/React-18+-61dafb)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6)
  ![Flask](https://img.shields.io/badge/Flask-3.0+-000000)
  ![Blueprint](https://img.shields.io/badge/Blueprint-5+-137cbd)
  ![License](https://img.shields.io/badge/License-Apache%202.0-green)
  ![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
</div>

## 🚀 One-Command Installation

```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/yourusername/localstore/main/install.sh | bash

# From source
./install.sh
```

The installer will:
- ✅ Verify Node.js 18+ and Python 3.11+
- ✅ Install all dependencies
- ✅ Build the production frontend
- ✅ Create sample tools
- ✅ Start LocalStore on port 8000
- ✅ Run smoke tests

## 🎯 Features

### Production-Ready
- **Two Modes Only**: Development (`npm run dev`) and Production (`npm run prod`)
- **Transactional Installs**: Atomic tool installation with rollback on failure
- **Process Management**: Robust port allocation, health checks, and auto-restart
- **Security Hardened**: Rate limiting, CSP headers, request validation, sandboxed execution
- **Schema Validation**: Shared TypeScript/Python schemas with JSON Schema
- **Comprehensive Testing**: Unit, integration, E2E, and smoke tests

### Developer-Friendly
- **Hot Reload**: Both frontend (Vite) and backend (Flask debug mode)
- **Built-in IDE**: Monaco editor with TypeScript support
- **Live Logs**: Real-time streaming with XTerm.js
- **File Management**: Create, edit, delete files with diff/undo
- **Git Integration**: Automatic repository initialization
- **Tool Wizard**: Scaffold new tools with templates

### UI/UX Polish
- **Modern Design**: Blueprint v5 components with dark mode
- **Responsive**: Works on desktop, tablet, and mobile
- **Progress Indicators**: Real-time feedback during operations
- **Keyboard Shortcuts**: Efficient navigation and actions
- **Accessibility**: ARIA labels, keyboard navigation, color contrast
- **Performance**: Code splitting, memoization, virtual scrolling

## 📋 Prerequisites

- **Node.js** 18+ with npm
- **Python** 3.11+ with pip
- **Git** (recommended for development features)
- **macOS** or **Linux** (Windows via WSL)

## 🏗️ Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Frontend (React)  │     │   Backend (Flask)   │     │   Tools (Python)    │
├─────────────────────┤     ├─────────────────────┤     ├─────────────────────┤
│ • React 18 + TS     │────▶│ • Flask 3.0         │────▶│ • FastAPI/Flask     │
│ • Blueprint v5      │     │ • Process Manager   │     │ • Isolated venvs    │
│ • Zustand + Vite    │◀────│ • Tool Installer    │     │ • Health checks     │
│ • Monaco + XTerm    │     │ • Security Layer    │     │ • Auto-restart      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

## 🚦 Quick Start

### Development Mode
```bash
npm run dev
# Frontend: http://localhost:3000 (hot reload)
# Backend: http://localhost:8000 (debug mode)
```

### Production Mode
```bash
npm run prod
# Everything at http://localhost:8000
# Static frontend served by Flask
# Gunicorn with 4 workers
```

## 📦 Project Structure

```
localstore/
├── frontend/              # React TypeScript frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── hooks/        # Custom React hooks
│   │   ├── state/        # Zustand stores
│   │   └── schemas.ts    # Shared type definitions
│   └── tests/
│       └── e2e/          # Playwright E2E tests
├── backend/              # Flask backend
│   ├── app.py           # Main Flask application
│   ├── proc.py          # Process manager
│   ├── install.py       # Tool installer
│   ├── security.py      # Security utilities
│   ├── schemas.py       # JSON Schema validation
│   └── tests/           # pytest test suite
├── tools/               # Installed tools
├── install.sh           # One-command installer
├── smoke_test.sh        # Production smoke test
└── package.json         # npm scripts
```

## 🛠️ Tool Development

### Creating a New Tool

1. **Use Tool Wizard** (recommended):
   - Navigate to Settings → Create Tool
   - Choose template (FastAPI/Flask)
   - Fill in metadata
   - Auto-generates scaffold

2. **Manual Creation**:
   ```python
   # tools/my-tool/app.py
   from fastapi import FastAPI
   
   app = FastAPI()
   
   @app.get("/health")
   def health():
       return {"status": "healthy"}
   
   @app.get("/")
   def root():
       return {"message": "Hello from my tool!"}
   ```
   
   ```txt
   # tools/my-tool/requirements.txt
   fastapi==0.104.1
   uvicorn==0.24.0
   ```

3. **Register in Registry**:
   ```json
   {
     "id": "my-tool",
     "name": "My Tool",
     "description": "A custom tool",
     "version": "1.0.0",
     "path": "tools/my-tool",
     "entry": "app:app",
     "tags": ["custom"]
   }
   ```

### Tool Entry Points
- **FastAPI**: `app:app` (module:variable)
- **Flask**: `app:app` or `app:create_app()`
- **Custom**: Any ASGI/WSGI callable

## 🔒 Security

### Built-in Protections
- **Rate Limiting**: Configurable per endpoint
- **Request Validation**: JSON Schema for all inputs
- **Path Traversal**: Blocked at multiple levels
- **Process Isolation**: Each tool in separate venv
- **CSP Headers**: Restrictive content security policy
- **API Authentication**: Optional Bearer token

### Environment Variables
```bash
# Optional API key protection
export LOCALSTORE_API_KEY=your-secret-key

# Production mode
export FLASK_ENV=production
export FLASK_DEBUG=0
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests with coverage
cd backend && pytest --cov

# Frontend unit tests
cd frontend && npm test

# E2E tests
cd frontend && npm run e2e

# Production smoke test
./smoke_test.sh
```

See [TESTING.md](TESTING.md) for comprehensive testing guide.

## 📊 Monitoring

### Health Endpoints
- Backend: `GET /api/health`
- Tools: `GET /health` (if implemented)

### Structured Logging
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "tool_started",
  "tool_id": "calculator",
  "port": 9001,
  "request_id": "abc123"
}
```

### Process Status
```bash
# Check tool status via API
curl http://localhost:8000/api/tools

# View logs
tail -f backend/app.log
```

## 🚀 Deployment

### Systemd Service (Linux)
```ini
[Unit]
Description=LocalStore
After=network.target

[Service]
Type=simple
User=localstore
WorkingDirectory=/opt/localstore
ExecStart=/opt/localstore/run_prod.sh
Restart=always

[Install]
WantedBy=multi-user.target
```

### Docker (Coming Soon)
```dockerfile
FROM python:3.11-slim
# ... Dockerfile content
```

### Reverse Proxy (nginx)
```nginx
server {
    listen 80;
    server_name localstore.example.com;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔧 Configuration

### Port Range
Tools are allocated ports from 9000-9999 by default. Configure in `backend/proc.py`:
```python
PortManager(port_range=(9000, 9999))
```

### File Limits
- Max upload: 16MB (configurable)
- Max file read: 1MB (for editor)

### Rate Limits
Default limits per endpoint:
- Install: 10/min
- Start/Stop: 30/min
- File operations: 30/min

## 🐛 Troubleshooting

### Common Issues

**Port already in use**
```bash
lsof -i :8000
kill -9 <PID>
```

**Python version issues**
```bash
python3 --version  # Must be 3.11+
# Use pyenv or conda to install correct version
```

**Permission denied**
```bash
chmod +x install.sh
sudo chown -R $USER:$USER tools/
```

**Tool won't start**
- Check logs: `tail -f backend/app.log`
- Verify venv: `ls tools/<tool-id>/.venv`
- Test manually: `cd tools/<tool-id> && .venv/bin/python -m uvicorn app:app`

### Debug Mode
```bash
# Enable debug logging
export FLASK_DEBUG=1
npm run dev

# Check browser console
# Check network tab for API errors
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Make changes with tests
4. Run all tests: `npm test && ./smoke_test.sh`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing`
7. Open Pull Request

### Development Setup
```bash
git clone https://github.com/yourusername/localstore
cd localstore
./install.sh
npm run dev
```

### Code Style
- Python: Black + isort
- TypeScript: Prettier + ESLint
- Commits: Conventional commits

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- [Blueprint](https://blueprintjs.com/) - UI components
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [XTerm.js](https://xtermjs.org/) - Terminal emulator
- [Flask](https://flask.palletsprojects.com/) - Backend framework
- [Vite](https://vitejs.dev/) - Frontend tooling

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/localstore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/localstore/discussions)
- **Security**: security@example.com

---

<div align="center">
  <p>Built with ❤️ for the Python community</p>
  <p>Make your Python tools accessible to everyone!</p>
</div>
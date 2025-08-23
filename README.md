# LocalStore

*Stop copy-pasting random Python scripts from GitHub. LocalStore gives you a secure, unified way to run them as polished web tools on your own machine.*

**LocalStore turns Python packages into one-click, browser-accessible web tools — bridging pip and modern app stores.**

---

## Table of Contents

- [Why LocalStore?](#why-localstore)
- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Tool Development](#tool-development)
- [API Reference](#api-reference)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)

---

## Why LocalStore?

The exponential growth of domain-specific Python tools has created a fragmented ecosystem where users encounter:

- **Security Risks**: Running untrusted scripts from random GitHub repositories
- **Installation Hassles**: Complex dependency management and environment setup
- **No Unified Interface**: Tools scattered across different platforms and formats
- **Limited Collaboration**: No easy way to share and run tools within teams

LocalStore solves these problems by providing a **self-hosted, Python-based marketplace** that transforms any Python package into a one-click, browser-accessible web tool with built-in development capabilities.

---

## Overview

LocalStore is a self-hosted platform that allows you to discover, install, and run Python-based web tools locally. It provides a unified marketplace interface where you can browse available tools, install them with one click, and run them as local web applications. The platform also includes powerful development features, allowing you to modify and extend tools directly within the interface.

**Key Benefits:**
- **Self-Hosted**: Complete control over your tools and data
- **One-Click Installation**: Automated dependency management and environment setup
- **Local Execution**: Tools run on your machine, ensuring privacy and performance
- **Development Mode**: Built-in code editor and development tools
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Modern UI**: Clean, responsive interface built with Preact and TypeScript
- **Zero Lock-in**: Tools are just FastAPI or Flask apps with an entry in registry.json

---

## Features

### User Features
- **Marketplace**: Browse and search available tools with descriptions and metadata
- **Tool Management**: Install, uninstall, start, and stop tools with simple controls
- **Status Monitoring**: Real-time tool status and port information
- **Search & Filtering**: Find tools by name, ID, or description
- **Responsive Design**: Modern UI that works on desktop and mobile browsers
- **Desktop App**: Optional Electron wrapper for native desktop experience

### Developer Features
- **Code Editor**: Built-in Monaco editor for viewing and editing tool source code
- **File Management**: Browse and edit tool files directly in the interface
- **Live Logs**: Real-time log streaming for running tools
- **Git Integration**: Automatic Git repository initialization for development workspaces
- **AI-Assisted Development**: Chat-based code modification (MVP implementation)
- **Process Management**: Automatic port allocation and process lifecycle management
- **Virtual Environments**: Each tool runs in its own isolated Python environment

---

## Quick Start

### 1. Install Dependencies
```bash
npm run setup
```

This command will:
- Install all Node.js dependencies for backend, frontend, and Electron
- Install Python dependencies
- Build the frontend application

**If you don't have a setup script yet, run:**
```bash
npm install && cd frontend && npm install && cd ../backend && pip install -r requirements.txt
```

### 2. Run the Application

#### Option A: Web Only (Recommended for development)
```bash
npm run dev
```

This starts both the backend (Flask) and frontend (Vite dev server) concurrently.

#### Option B: Desktop App
```bash
npm run electron
```

This launches the Electron app which spawns the backend and opens a desktop window.

#### Option C: Windows Batch File
```bash
run.bat
```

Simple Windows batch file that starts the development servers.

### 3. Access the Application
- **Web**: http://localhost:3000 (frontend) + http://localhost:8000 (backend API)
- **Desktop**: Electron window pointing to http://127.0.0.1:8000

---

## Project Structure

```
localstore/
├── backend/                 # Flask API server
│   ├── app.py              # Main Flask application
│   ├── dev_api.py          # Development mode API endpoints
│   ├── install.py          # Tool installation logic
│   ├── proc.py             # Process management
│   ├── registry.json       # Available tools registry
│   ├── requirements.txt    # Python dependencies
│   └── data/               # Runtime data and state
│       └── install_state.json  # Persistent installation state
├── frontend/                # Preact + TypeScript frontend
│   ├── src/                # Source code
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   └── api.ts          # API client
│   ├── dist/               # Built files (generated)
│   └── package.json        # Frontend dependencies
├── electron/                # Desktop shell (optional)
│   ├── main.js             # Electron main process
│   └── package.json        # Electron dependencies
├── examples/                # Sample tools
│   └── hello-fapi/         # FastAPI demo tool
├── tools/                   # Installed tools (generated)
└── package.json             # Root scripts and dependencies
```

---

## Development

### Backend (Flask)
- **Port**: 8000
- **API Endpoints**: RESTful API for tool management and development
- **Run**: `npm run backend`
- **Features**: Process management, virtual environment handling, file operations

### Frontend (Preact + Vite)
- **Port**: 3000 (dev), 8000 (production via backend)
- **Build**: `npm run build`
- **Dev**: `npm run frontend`
- **Framework**: Preact with TypeScript for modern, lightweight UI

### Electron (Desktop)
- **Run**: `npm run electron`
- **Note**: Requires backend to be running first
- **Purpose**: Provides native desktop experience

---

## Tool Development

### Creating a Tool
**Tools are just FastAPI or Flask apps with an entry in registry.json.** No special frameworks or lock-in required.

```python
# app.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"hello": "world"}

@app.get("/ping")
def ping():
    return {"pong": True}
```

### Tool Metadata
Tools are registered in `backend/registry.json`:

```json
{
  "id": "hello-fapi",
  "name": "Hello FastAPI",
  "description": "Tiny demo tool",
  "path": "examples/hello-fapi",
  "entry": "app:app"
}
```

### Development Workflow
1. **Install**: Tools are automatically installed with dependencies
2. **Fork**: Create a development workspace for modifications
3. **Edit**: Use the built-in code editor to modify files
4. **Run**: Start/stop the tool and view live logs
5. **Deploy**: Changes are applied to the running tool

---

## API Reference

### Core Endpoints
- `GET /api/health` - Health check
- `GET /api/registry` - List available tools
- `GET /api/tools` - List installed tools
- `POST /api/tools/install` - Install a tool
- `POST /api/tools/{id}/start` - Start a tool
- `POST /api/tools/{id}/stop` - Stop a tool
- `DELETE /api/tools/{id}` - Uninstall a tool

### Development Endpoints
- `POST /api/dev/{id}/fork` - Create development workspace
- `GET /api/dev/{id}/files` - List workspace files
- `GET /api/dev/{id}/file` - Read file content
- `POST /api/dev/{id}/file` - Write file content
- `POST /api/dev/{id}/patch` - Apply code patches
- `GET /api/dev/{id}/logs` - Stream tool logs
- `POST /api/dev/{id}/chat` - AI-assisted code modification (stub MVP)

### Tool Proxy
- `GET /api/apps/{id}/*` - Proxy requests to running tools

---

## Requirements

### System Requirements
- **Node.js**: 18+ 
- **Python**: 3.8+ (with pip)
- **Operating System**: Windows 11, macOS, or Linux
- **Memory**: 4GB RAM recommended
- **Storage**: 2GB free space for tools and dependencies

### Python Dependencies
- Flask 2.3.3+
- Flask-CORS 4.0.0+
- uvicorn (for FastAPI tools)

### Browser Support
- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge

---

## Troubleshooting

### Common Issues

#### Python not found
- **Windows**: Ensure Python is in PATH or use `python` command
- **WSL2**: Use `python3` command
- **Solution**: Install Python from https://python.org

#### Port conflicts
- **Backend**: Uses port 8000
- **Frontend dev**: Uses port 3000
- **Solution**: Change ports in respective config files if needed

#### Build issues
- **Dependencies**: Run `npm run install-all` to ensure all dependencies are installed
- **Node version**: Check Node.js version compatibility
- **Python venv**: Ensure virtual environments can be created

#### Tool installation failures
- **Dependencies**: Check tool requirements.txt files
- **Permissions**: Ensure write access to tools directory
- **Network**: Verify internet connection for pip installations

### Getting Help
- Check the application logs in the browser console
- Review backend logs in the terminal
- Verify tool registry and installation state
- Ensure all dependencies are properly installed

---

## Contributing

LocalStore is designed to be extensible. You can contribute by:

1. **Adding Tools**: Create new Python tools and submit them to the registry
2. **Improving UI**: Enhance the frontend components and user experience
3. **Backend Features**: Extend the Flask API with new capabilities
4. **Documentation**: Improve this README and add tool documentation

### Development Setup
1. Fork the repository
2. Install dependencies with `npm run setup`
3. Make your changes
4. Test with `npm run dev`
5. Submit a pull request

---

## License

LocalStore is released under the MIT License, promoting open-source accessibility and community-driven innovation.

---

*For further information, contribution guidelines, and advanced configuration, please consult the project documentation or contact the maintainers.*

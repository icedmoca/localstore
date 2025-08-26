# localstore

> **A self-hosted Python tool marketplace with built-in development capabilities**

LocalStore transforms any Python package into a one-click, browser-accessible web tool. It provides a unified interface for discovering, installing, running, and developing Python-based applications locally with zero external dependencies.

## **⚡ Quick Install**

Get LocalStore running instantly with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/icedmoca/localstore/main/install.sh | bash
```

The install script automatically sets up Node.js, Python, dependencies, and LocalStore itself. Once complete, access LocalStore at `http://localhost:8000`.

![LocalStore Dashboard](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11+-blue)
![React](https://img.shields.io/badge/React-18+-61dafb)
![Blueprint](https://img.shields.io/badge/Blueprint-5+-137cbd)
![License](https://img.shields.io/badge/License-ISC-lightgrey)

## **Why LocalStore?**

The Python ecosystem is fragmented with tools scattered across different platforms. LocalStore solves this by providing:

- **Security**: Run tools locally without trusting external servers
- **One-Click Setup**: Automated dependency management and environment setup
- **Development Mode**: Built-in code editor and live development tools
- **Web Interface**: Access tools through a modern, responsive web UI
- **Zero Lock-in**: Tools are standard Python apps (FastAPI/Flask)
- **Beautiful UI**: Modern interface with Blueprint v5 and Berkeley Mono TX font

## **Features**

### **User Experience**
- **Dashboard**: Clean, card-based interface showing all installed tools
- **Tool Discovery**: Browse available tools with descriptions and metadata
- **One-Click Install**: Automated setup with virtual environments
- **Start/Stop Controls**: Simple tool lifecycle management
- **Real-time Status**: Live monitoring of running tools
- **Dark Mode**: Complete dark theme support throughout the application

### **Developer Experience**
- **Code Editor**: Built-in Monaco editor for viewing and editing source code
- **File Browser**: Navigate tool file structure directly in the UI
- **Live Logs**: Real-time streaming of tool output and errors
- **Git Integration**: Automatic repository initialization for development
- **Process Management**: Automatic port allocation and process lifecycle
- **Virtual Environments**: Each tool runs in isolated Python environments

### **Technical Features**
- **Modern Stack**: React 18+ with TypeScript and Blueprint v5
- **Custom Typography**: Berkeley Mono TX monospace font throughout
- **Responsive Design**: Works seamlessly on desktop and mobile
- **API-First**: RESTful API for all operations
- **Hot Reload**: Instant updates during development
- **Testing**: Comprehensive testing with Vitest and Playwright

## **Quick Start**

### **Prerequisites**
- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **Git** (for development features)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/icedmoca/localstore.git
   cd localstore
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend && npm install
   
   # Install backend dependencies
   cd ../backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   ```

3. **Start the application**
   ```bash
   # Development mode (frontend + backend)
   npm run dev
   
   # Production mode (single command)
   npm run prod
   ```

### **Access the Application**
- **Development**: Frontend at http://localhost:3000, Backend at http://localhost:8000
- **Production**: Everything at http://localhost:8000

## **Architecture**

LocalStore follows a modern, microservice-inspired architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │     Tools       │
│   (React 18+)   │◄──►│   (Flask API)   │◄──►│  (Python Apps)  │
│                 │    │                 │    │                 │
│ • Blueprint v5  │    │ • Tool Manager  │    │ • FastAPI       │
│ • TypeScript    │    │ • Process Ctrl  │    │ • Flask         │
│ • Berkeley Mono │    │ • Dev Mode      │    │ • Custom Apps   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Frontend Architecture**
- **Framework**: React 18+ with TypeScript
- **UI Library**: Blueprint v5 for professional components
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: CSS custom properties with Berkeley Mono TX font
- **Build Tool**: Vite for fast development and optimized builds

### **Backend Architecture**
- **Framework**: Flask with CORS support
- **Process Management**: Custom ProcManager for tool lifecycle
- **Virtual Environments**: Automatic Python venv creation and management
- **Development Mode**: Blueprint-based API for development features
- **State Management**: Atomic JSON state with file persistence

### **Tool Architecture**
- **Standard Format**: Any Python web app (FastAPI/Flask)
- **Entry Point**: Configurable via `entry` field in registry
- **Dependencies**: Automatic installation from requirements.txt
- **Isolation**: Each tool runs in its own virtual environment
- **Port Management**: Automatic port allocation and conflict resolution

## **Project Structure**

```
localstore/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── styles.css      # Global styles with Berkeley Mono TX
│   │   └── main.tsx        # Application entry point
│   ├── public/
│   │   └── fonts/          # Berkeley Mono TX font files
│   └── package.json        # Frontend dependencies
├── backend/                 # Flask backend API
│   ├── app.py              # Main Flask application
│   ├── dev_api.py          # Development mode API
│   ├── install.py          # Tool installation logic
│   ├── proc.py             # Process management
│   ├── registry.json       # Available tools registry
│   └── requirements.txt    # Python dependencies
├── tools/                   # Installed tools directory
├── examples/                # Example tools
│   └── hello-fapi/         # Sample FastAPI application
├── electron/                # Desktop app wrapper (optional)
└── package.json             # Root project configuration
```

## **Usage**

### **Installing Tools**

1. **Browse Available Tools**: View the registry of available tools
2. **Click Install**: One-click installation with automatic dependency setup
3. **Start the Tool**: Launch the tool with a single click
4. **Access the Tool**: Open the tool in your browser at the assigned port

### **Development Mode**

1. **Fork a Tool**: Create a development workspace from an installed tool
2. **Edit Code**: Use the built-in Monaco editor to modify source code
3. **View Files**: Navigate the tool's file structure
4. **Live Logs**: Monitor real-time output and errors
5. **Git Integration**: Automatic repository initialization for version control

### **Creating Custom Tools**

1. **Create Tool Structure**:
   ```
   my-tool/
   ├── app.py              # Main application file
   ├── requirements.txt     # Python dependencies
   └── README.md           # Tool description
   ```

2. **Add to Registry**:
   ```json
   {
     "id": "my-tool",
     "name": "My Custom Tool",
     "description": "Description of what the tool does",
     "path": "tools/my-tool",
     "entry": "app:app"
   }
   ```

3. **Install and Run**: Use the LocalStore interface to install and run your tool

## **Configuration**

### **Environment Variables**
- `FLASK_DEBUG`: Set to 0 for production, 1 for development
- `PYTHONUNBUFFERED`: Set to 1 for immediate log output

### **Registry Configuration**
The `backend/registry.json` file defines available tools:
```json
[
  {
    "id": "tool-id",
    "name": "Display Name",
    "description": "Tool description",
    "version": "1.0.0",
    "author": "Author Name",
    "path": "path/to/tool",
    "entry": "module:app"
  }
]
```

### **Tool Entry Points**
- **FastAPI**: `app:app` (app variable from app module)
- **Flask**: `app:app` (app variable from app module)
- **Custom**: `module:variable` (any Python callable)

## **Testing**

### **Frontend Tests**
```bash
cd frontend
npm test              # Run unit tests with Vitest
npm run test:ui       # Run tests with UI
npm run e2e           # Run end-to-end tests with Playwright
```

### **Backend Tests**
```bash
npm run test:contract  # Run API contract tests
```

### **Manual Testing**
1. Start the application: `npm run dev`
2. Install a tool from the examples
3. Test start/stop functionality
4. Verify development mode features

## **Deployment**

### **Development**
```bash
npm run dev
```
- Frontend: http://localhost:3000 (with hot reload)
- Backend: http://localhost:8000 (API only)

### **Production**
```bash
npm run prod
```
- Single command builds frontend and starts backend
- Everything served from http://localhost:8000
- Optimized production build

### **Docker (Future)**
```dockerfile
# Coming soon - Docker support for easy deployment
FROM python:3.11-slim
# ... Docker configuration
```

## 🔌 **API Reference**

### **Core Endpoints**
- `GET /api/health` - Health check
- `GET /api/registry` - List available tools
- `GET /api/tools` - List installed tools
- `POST /api/tools/install` - Install a tool
- `POST /api/tools/{id}/start` - Start a tool
- `POST /api/tools/{id}/stop` - Stop a tool

### **Development Endpoints**
- `POST /api/dev/{id}/fork` - Create development workspace
- `GET /api/dev/{id}/files` - List workspace files
- `GET /api/dev/{id}/file?path=...` - Read file content
- `POST /api/dev/{id}/file` - Write file content
- `POST /api/dev/{id}/run` - Execute commands
- `GET /api/dev/{id}/logs` - Stream live logs

## **Customization**

### **Styling**
The application uses CSS custom properties for theming:
```css
:root {
  --bg: #ffffff;
  --fg: #111827;
  --accent: #2563eb;
  --font-family: 'Berkeley Mono TX', monospace;
}
```

### **Fonts**
Berkeley Mono TX is the primary font, with fallbacks to system monospace fonts.

### **Components**
All UI components are built with Blueprint v5, ensuring consistency and accessibility.

## **Troubleshooting**

### **Common Issues**

**Tool won't start**
- Check if port is already in use
- Verify virtual environment is properly created
- Check tool logs for Python errors

**Installation fails**
- Ensure Python 3.11+ is installed
- Check if pip is available in the virtual environment
- Verify tool path exists in registry

**Frontend won't load**
- Check if backend is running on port 8000
- Verify Vite dev server is running on port 3000
- Check browser console for JavaScript errors

### **Logs and Debugging**
- Backend logs: Check terminal output
- Frontend logs: Check browser console
- Tool logs: Use the development mode log viewer

## **Contributing**

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### **Development Setup**
```bash
# Clone and setup
git clone <your-fork>
cd localstore
npm install
cd frontend && npm install
cd ../backend && python -m venv venv && pip install -r requirements.txt

# Start development
npm run dev
```

## 📄 **License**

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **Blueprint v5** for the beautiful UI components
- **Berkeley Mono TX** for the elegant typography
- **React 18+** for the modern frontend framework
- **Flask** for the robust backend API
- **Vite** for the lightning-fast build tool

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/icedmoca/localstore/issues)
- **Discussions**: [GitHub Discussions](https://github.com/icedmoca/localstore/discussions)
- **Documentation**: [Wiki](https://github.com/icedmoca/localstore/wiki)

---

**Made with ❤️ for the Python community**

Transform your Python tools into beautiful web applications with LocalStore! 🚀

# LocalStore IDE - Upgrade Documentation

This document describes the major upgrades made to the LocalStore IDE, transforming it into a modern, production-ready browser-based development environment.

## 🎯 Overview

The LocalStore IDE has been completely modernized with:

- **React Router v6** for robust client-side routing
- **FastAPI backend** replacing Flask for better performance
- **BlueprintJS v5** for professional UI components
- **Zustand** for efficient state management
- **Tool Settings** restoration with comprehensive configuration
- **Preview/Run** functionality with live logs
- **SPA fallbacks** preventing 404s on refresh/deep links

## 🚀 Quick Start

### Prerequisites

- Python 3.8+ 
- Node.js 16+
- npm or yarn

### Installation

1. **Install Python dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Install Node.js dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Build frontend:**
   ```bash
   npm run build
   ```

### Development

Run both frontend and backend in development mode:

```bash
# From project root
npm run dev
```

This starts:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000` (proxies API calls to backend)

### Production

Build and run in production mode:

```bash
npm run prod
```

## 🔧 Architecture Changes

### Frontend (React 18 + TypeScript)

#### Routing System
- **Before:** Wouter with basic routing
- **After:** React Router v6 with proper basename support
- **Routes:**
  - `/dashboard` - Main tool dashboard
  - `/tools/:toolId/edit` - IDE editor interface
  - `/tools/:toolId/settings` - Tool configuration
  - `/tools/:toolId/preview` - Live preview with logs
  - `*` - 404 fallback with recovery options

#### State Management
- **Zustand store** (`src/state/useToolStore.ts`) with slices:
  - **Tool slice:** Current tool, tools list, updates
  - **Files slice:** File tree, expansion state, selection
  - **Editor slice:** Tabs, content, auto-save, dirty state
  - **Git slice:** Status, branches, staged/unstaged files
  - **Run slice:** Status, port, logs streaming
  - **UI slice:** Panel sizes, visibility, tabs, theme

#### Key Components

**Tool Settings Dialog** (`src/features/settings/ToolSettingsDialog.tsx`):
- **General:** Name, description, tags, metadata
- **Runtime:** Start command, ports, auto-restart
- **Environment:** Key-value editor with secrets support
- **Permissions:** File access, network, GPU controls
- **Advanced:** Reset/delete with confirmation

**Preview Page** (`src/pages/Preview.tsx`):
- **Live preview** in iframe
- **Real-time logs** with SSE streaming
- **Start/stop/restart** controls
- **Download/clear logs** functionality

**Enhanced IDE** (`src/pages/EditTool.tsx`):
- **Multi-tab editor** with dirty state tracking
- **File explorer** with context menus
- **Auto-save** with configurable delays
- **Keyboard shortcuts** (⌘P, ⌘S, F5, etc.)
- **Split panels** with resizable layouts

### Backend (FastAPI)

#### API Migration
- **Before:** Flask with basic CRUD
- **After:** FastAPI with Pydantic models, type safety
- **File:** `backend/fastapi_app.py`

#### Key Improvements
- **SPA fallback:** Serves `index.html` for non-API routes
- **Static mounting:** Proper asset serving with cache headers
- **Type validation:** Pydantic models for requests/responses
- **Async support:** Better performance for I/O operations
- **CORS middleware:** Properly configured for development

#### API Endpoints
All existing endpoints maintained for backward compatibility:
- `GET /api/tools` - List installed tools
- `POST /api/tools/install` - Install new tool
- `GET /api/tools/{id}/files` - File tree
- `POST /api/tools/{id}/start` - Start tool
- `GET /api/tools/{id}/logs` - SSE log streaming
- `PATCH /api/tools/{id}` - Update tool settings

## 🎨 UI/UX Improvements

### BlueprintJS Integration
- **Consistent design** system throughout
- **Accessibility** features built-in
- **Dark/light themes** with persistence
- **Professional icons** and typography

### Navigation
- **Breadcrumbs** for context awareness
- **Navbar** with tool switcher
- **Back button** safe navigation
- **Deep linking** support

### Editor Experience
- **Monaco editor** integration
- **Syntax highlighting** for multiple languages
- **File tree** with Git status indicators
- **Search and replace** across files
- **Command palette** (⌘P)

## 🔄 Migration Guide

### For Existing Projects

1. **Update dependencies:**
   ```bash
   cd frontend && npm install
   cd ../backend && pip install -r requirements.txt
   ```

2. **Update run scripts:**
   ```bash
   # Old: python backend/app.py
   # New: python backend/fastapi_app.py
   ```

3. **Environment variables:**
   ```bash
   # Optional: Set base path for subpath deployment
   export VITE_PUBLIC_BASE="/localstore"
   ```

4. **Settings migration:**
   - Tool settings are now accessible via gear icon in editor
   - Environment variables can be imported/exported as JSON
   - Auto-restart setting moved to Runtime tab

### Breaking Changes

- **Routing:** URLs changed from `/edit/:id` to `/tools/:id/edit`
- **Backend:** Flask replaced with FastAPI (API compatible)
- **State:** Local component state moved to Zustand store

## 🧪 Testing

### Run Tests
```bash
cd frontend
npm test
```

### Test Coverage
- **Component tests:** React Testing Library
- **Store tests:** Zustand state management
- **Routing tests:** React Router navigation
- **API mocking:** MSW for backend simulation

### Key Test Files
- `src/__tests__/App.test.tsx` - Main app routing
- `src/__tests__/NotFound.test.tsx` - 404 handling
- `src/__tests__/useToolStore.test.ts` - State management

## 🚀 Deployment

### Subpath Deployment

For hosting under a subpath (e.g., `yoursite.com/localstore`):

1. **Set environment variables:**
   ```bash
   export VITE_PUBLIC_BASE="/localstore"
   ```

2. **Build with base path:**
   ```bash
   npm run build
   ```

3. **Configure reverse proxy:**
   ```nginx
   location /localstore/ {
       proxy_pass http://localhost:8000/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

### Docker Deployment

```dockerfile
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/backend/static ./static
EXPOSE 8000
CMD ["python", "fastapi_app.py"]
```

## 🔍 Acceptance Criteria Verification

✅ **Navigation:** Refresh on `/tools/:id/edit` or `/tools/:id/settings` returns proper content, no 404
✅ **Back button:** Browser back navigation works without 404s
✅ **Settings:** Gear icon opens settings, environment variables persist
✅ **Preview:** Run/stop controls work, logs stream in real-time
✅ **Deep links:** All routes accessible via direct URL
✅ **State persistence:** UI layout, theme, and preferences saved
✅ **Keyboard shortcuts:** ⌘P (palette), ⌘S (save), F5 (run) work
✅ **Accessibility:** Proper focus management, ARIA labels

## 📚 Additional Resources

- **BlueprintJS Docs:** https://blueprintjs.com/docs/
- **React Router v6:** https://reactrouter.com/en/main
- **Zustand Guide:** https://docs.pmnd.rs/zustand/getting-started/introduction
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Monaco Editor:** https://microsoft.github.io/monaco-editor/

## 🐛 Troubleshooting

### Common Issues

1. **404 on refresh:** Check that FastAPI SPA fallback is working
2. **Styles not loading:** Ensure static files are mounted correctly
3. **Hot reload broken:** Check Vite proxy configuration
4. **Settings not saving:** Verify FastAPI PATCH endpoint works
5. **Preview not loading:** Check tool is running and port is accessible

### Debug Commands

```bash
# Check backend health
curl http://localhost:8000/api/health

# Check static files
curl http://localhost:8000/index.html

# Test API endpoints
curl http://localhost:8000/api/tools

# View frontend build
ls -la backend/static/
```

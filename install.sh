#!/bin/bash

# LocalStore One-Command Install Script
# Production-ready installer for macOS/Linux

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIN_NODE_VERSION=18
MIN_PYTHON_VERSION="3.11"
DEFAULT_PORT=8000

# Print functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                      LocalStore IDE                          ║"
    echo "║        Self-hosted Python Tool Marketplace                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if running on supported OS
check_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    else
        print_error "Unsupported OS: $OSTYPE"
        print_error "This installer supports macOS and Linux only."
        exit 1
    fi
    print_status "Detected OS: $OS"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Version comparison
version_ge() {
    # Returns 0 if version $1 >= version $2
    printf '%s\n%s' "$2" "$1" | sort -V -C
}

# Check Node.js
check_node() {
    if ! command_exists node; then
        print_error "Node.js is not installed"
        print_error "Please install Node.js ${MIN_NODE_VERSION}+ from https://nodejs.org"
        return 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    
    if [ "$NODE_MAJOR" -lt "$MIN_NODE_VERSION" ]; then
        print_error "Node.js version $NODE_VERSION is too old"
        print_error "Please upgrade to Node.js ${MIN_NODE_VERSION}+"
        return 1
    fi
    
    print_success "Node.js $NODE_VERSION ✓"
    return 0
}

# Check Python
check_python() {
    PYTHON_CMD=""
    
    # Try different Python commands
    for cmd in python3 python python3.11 python3.12; do
        if command_exists "$cmd"; then
            VERSION=$("$cmd" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
            if version_ge "$VERSION" "$MIN_PYTHON_VERSION"; then
                PYTHON_CMD="$cmd"
                break
            fi
        fi
    done
    
    if [ -z "$PYTHON_CMD" ]; then
        print_error "Python ${MIN_PYTHON_VERSION}+ is not installed"
        print_error "Please install Python from https://python.org"
        return 1
    fi
    
    # Check pip
    if ! "$PYTHON_CMD" -m pip --version >/dev/null 2>&1; then
        print_error "pip is not installed for $PYTHON_CMD"
        print_error "Please install pip: $PYTHON_CMD -m ensurepip"
        return 1
    fi
    
    PYTHON_VERSION=$("$PYTHON_CMD" --version | awk '{print $2}')
    print_success "Python $PYTHON_VERSION ✓"
    export PYTHON_CMD
    return 0
}

# Check Git (optional but recommended)
check_git() {
    if command_exists git; then
        GIT_VERSION=$(git --version | awk '{print $3}')
        print_success "Git $GIT_VERSION ✓"
        return 0
    else
        print_warning "Git is not installed (optional, but recommended for development features)"
        return 0
    fi
}

# Check port availability
check_port() {
    local port=$1
    if [[ "$OS" == "macos" ]]; then
        if lsof -i ":$port" >/dev/null 2>&1; then
            return 1
        fi
    else
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            return 1
        fi
    fi
    return 0
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    print_status "Installing root Node.js dependencies..."
    npm ci --silent || npm install --silent
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm ci --silent || npm install --silent
    cd ..
    
    # Install backend dependencies
    print_status "Setting up Python virtual environment..."
    cd backend
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        "$PYTHON_CMD" -m venv venv
    fi
    
    # Activate and install dependencies
    if [[ "$OS" == "macos" || "$OS" == "linux" ]]; then
        source venv/bin/activate
    fi
    
    print_status "Installing Python dependencies..."
    pip install --upgrade pip setuptools wheel >/dev/null 2>&1
    
    # Create enhanced requirements.txt with Flask as default
    cat > requirements.txt << 'EOF'
# Core Framework (Flask as default)
flask==3.0.0
flask-cors==4.0.0

# Optional Framework (FastAPI for compatibility)
fastapi==0.104.1
uvicorn[standard]==0.24.0

# Production Server
gunicorn==21.2.0

# HTTP Client
httpx==0.25.2

# Process Management
psutil==5.9.6

# State Management
filelock==3.13.1

# Validation
pydantic==2.5.0
jsonschema==4.20.0

# Git Support
gitpython==3.1.40

# Utilities
python-dotenv==1.0.0
click==8.1.7

# Logging
python-json-logger==2.0.7

# Security
cryptography==41.0.7

# Development
watchdog==3.0.0
EOF
    
    pip install -r requirements.txt
    
    cd ..
    
    print_success "All dependencies installed ✓"
}

# Build frontend
build_frontend() {
    print_status "Building frontend for production..."
    cd frontend
    npm run build
    
    # Copy built files to backend/static
    print_status "Copying built files to backend/static..."
    rm -rf ../backend/static
    mkdir -p ../backend/static
    cp -r dist/* ../backend/static/
    
    cd ..
    print_success "Frontend built successfully ✓"
}

# Create sample tool
create_sample_tool() {
    print_status "Creating sample calculator tool..."
    
    # Ensure tools directory exists
    mkdir -p tools/calculator
    
    # Create calculator app.py
    cat > tools/calculator/app.py << 'EOF'
"""
Sample Calculator Tool for LocalStore
A simple web-based calculator with FastAPI
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Union
import math

app = FastAPI(title="Calculator", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Calculation(BaseModel):
    expression: str

class Result(BaseModel):
    result: Union[float, str]
    expression: str

class HealthCheck(BaseModel):
    status: str
    name: str
    version: str

# Health check endpoint
@app.get("/health", response_model=HealthCheck)
async def health():
    return HealthCheck(
        status="healthy",
        name="Calculator",
        version="1.0.0"
    )

# Calculator endpoint
@app.post("/calculate", response_model=Result)
async def calculate(calc: Calculation):
    try:
        # Safe evaluation with limited functions
        allowed_names = {
            k: v for k, v in math.__dict__.items() if not k.startswith("_")
        }
        allowed_names.update({
            "abs": abs,
            "round": round,
            "min": min,
            "max": max,
        })
        
        # Evaluate the expression
        result = eval(calc.expression, {"__builtins__": {}}, allowed_names)
        
        return Result(
            result=float(result),
            expression=calc.expression
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Frontend route
@app.get("/")
async def root():
    return {
        "message": "Calculator API",
        "endpoints": {
            "/health": "Health check",
            "/calculate": "Calculate expression (POST)",
            "/docs": "API documentation"
        }
    }
EOF

    # Create requirements.txt
    cat > tools/calculator/requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
EOF

    print_success "Sample calculator tool created ✓"
}

# Create production scripts
create_scripts() {
    print_status "Creating production scripts..."
    
    # Create run script for development
    cat > run_dev.sh << 'EOF'
#!/bin/bash
# Development mode launcher
echo "Starting LocalStore in development mode..."

# Check if port 3000 and 8000 are available
for port in 3000 8000; do
    if lsof -i ":$port" >/dev/null 2>&1; then
        echo "Error: Port $port is already in use"
        exit 1
    fi
done

# Start with npm run dev
npm run dev
EOF
    chmod +x run_dev.sh
    
    # Create run script for production  
    cat > run_prod.sh << 'EOF'
#!/bin/bash
# Production mode launcher
echo "Starting LocalStore in production mode..."

# Check if port 8000 is available
if lsof -i ":8000" >/dev/null 2>&1; then
    echo "Error: Port 8000 is already in use"
    exit 1
fi

# Start with npm run prod
npm run prod
EOF
    chmod +x run_prod.sh
    
    print_success "Production scripts created ✓"
}

# Initialize data directory
initialize_data() {
    print_status "Initializing data directory..."
    
    # Create data directory
    mkdir -p backend/data
    
    # Create initial registry
    cat > backend/registry.json << 'EOF'
[
    {
        "id": "calculator",
        "name": "Calculator",
        "description": "A simple web-based calculator with mathematical functions",
        "version": "1.0.0",
        "author": "LocalStore",
        "path": "tools/calculator",
        "entry": "app:app",
        "tags": ["utility", "math"],
        "icon": "calculator"
    }
]
EOF
    
    print_success "Data directory initialized ✓"
}

# Run smoke test
run_smoke_test() {
    print_status "Running smoke test..."
    
    # Start backend in background
    cd backend
    source venv/bin/activate
    export FLASK_DEBUG=0
    python app.py &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    sleep 3
    
    # Test health endpoint
    if curl -s http://localhost:8000/api/health | grep -q '"ok":true'; then
        print_success "Backend health check passed ✓"
    else
        print_error "Backend health check failed"
        kill $BACKEND_PID 2>/dev/null
        return 1
    fi
    
    # Stop backend
    kill $BACKEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    
    print_success "Smoke test passed ✓"
    return 0
}

# Main installation
main() {
    print_banner
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    check_os || exit 1
    check_node || exit 1
    check_python || exit 1
    check_git
    
    # Check port availability
    if ! check_port $DEFAULT_PORT; then
        print_warning "Port $DEFAULT_PORT is in use. LocalStore will use the next available port."
    fi
    
    # Install dependencies
    install_dependencies
    
    # Build frontend
    build_frontend
    
    # Create sample tool
    create_sample_tool
    
    # Initialize data
    initialize_data
    
    # Create scripts
    create_scripts
    
    # Run smoke test
    if run_smoke_test; then
        print_success "Installation completed successfully! 🎉"
    else
        print_warning "Installation completed but smoke test failed"
    fi
    
    # Print next steps
    echo ""
    echo -e "${GREEN}✨ LocalStore is ready!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Start development mode:  ${BLUE}npm run dev${NC}"
    echo -e "  2. Start production mode:   ${BLUE}npm run prod${NC}"
    echo -e "  3. Access LocalStore at:    ${BLUE}http://localhost:8000${NC}"
    echo ""
    echo -e "${YELLOW}Quick commands:${NC}"
    echo -e "  • Run tests:     ${BLUE}npm test${NC}"
    echo -e "  • Run E2E tests: ${BLUE}npm run e2e${NC}"
    echo -e "  • View logs:     ${BLUE}tail -f backend/app.log${NC}"
    echo ""
    
    # Offer to start now
    read -p "🚀 Start LocalStore now in production mode? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Starting LocalStore...${NC}"
        npm run prod
    fi
}

# Handle errors
trap 'print_error "Installation failed. Check the error messages above."; exit 1' ERR

# Run main installation
main "$@"
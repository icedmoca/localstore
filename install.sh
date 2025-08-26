#!/bin/bash

# LocalStore One-Command Install Script
# This script sets up Node.js, Python, dependencies, and LocalStore in one command

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ASCII Art
echo -e "${BLUE}"
cat << "EOF"
 ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄           ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄ 
▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░▌         ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌
▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀▀▀ ▐░█▀▀▀▀▀▀▀▀▀ ▐░█▀▀▀▀▀▀▀█░▌▐░▌         ▐░█▀▀▀▀▀▀▀▀▀  ▀▀▀▀█░█▀▀▀▀ ▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌
▐░▌       ▐░▌▐░▌          ▐░▌          ▐░▌       ▐░▌▐░▌         ▐░▌               ▐░▌     ▐░▌       ▐░▌▐░▌       ▐░▌
▐░█▄▄▄▄▄▄▄█░▌▐░▌          ▐░▌          ▐░█▄▄▄▄▄▄▄█░▌▐░▌         ▐░█▄▄▄▄▄▄▄▄▄      ▐░▌     ▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄█░▌
▐░░░░░░░░░░░▌▐░▌          ▐░▌          ▐░░░░░░░░░░░▌▐░▌         ▐░░░░░░░░░░░▌     ▐░▌     ▐░▌       ▐░▌▐░░░░░░░░░░░▌
▐░█▀▀▀▀▀▀▀█░▌▐░▌          ▐░▌          ▐░█▀▀▀▀▀▀▀█░▌▐░▌          ▀▀▀▀▀▀▀▀▀█░▌     ▐░▌     ▐░▌       ▐░▌▐░█▀▀▀▀█░█▀▀ 
▐░▌       ▐░▌▐░▌          ▐░▌          ▐░▌       ▐░▌▐░▌                    ▐░▌     ▐░▌     ▐░▌       ▐░▌▐░▌     ▐░▌  
▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄▄▄ ▐░█▄▄▄▄▄▄▄▄▄ ▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄█░▌     ▐░▌     ▐░█▄▄▄▄▄▄▄█░▌▐░▌      ▐░▌ 
▐░▌       ▐░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░▌       ▐░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌     ▐░▌     ▐░░░░░░░░░░░▌▐░▌       ▐░▌
 ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀       ▀       ▀▀▀▀▀▀▀▀▀▀▀  ▀         ▀ 
EOF
echo -e "${NC}"

echo -e "${GREEN}LocalStore - Self-hosted Python Tool Marketplace${NC}"
echo -e "${YELLOW}Setting up your development environment in seconds...${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
    print_status "Detected OS: $OS"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Node.js if not present
install_node() {
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js already installed: $NODE_VERSION"
        
        # Check if version is 18+
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 18 ]; then
            print_warning "Node.js version is less than 18. Consider upgrading."
        fi
        return
    fi

    print_status "Installing Node.js..."
    
    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install node
        else
            print_error "Homebrew not found. Please install Node.js 18+ manually from https://nodejs.org"
            exit 1
        fi
    elif [[ "$OS" == "linux" ]]; then
        # Try different package managers
        if command_exists apt-get; then
            # Ubuntu/Debian
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command_exists yum; then
            # RHEL/CentOS
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo yum install -y nodejs npm
        elif command_exists dnf; then
            # Fedora
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo dnf install -y nodejs npm
        elif command_exists pacman; then
            # Arch Linux
            sudo pacman -S nodejs npm
        else
            print_error "Package manager not found. Please install Node.js 18+ manually from https://nodejs.org"
            exit 1
        fi
    else
        print_error "Unsupported OS for automatic Node.js installation. Please install Node.js 18+ manually from https://nodejs.org"
        exit 1
    fi
    
    print_success "Node.js installed successfully"
}

# Install Python if not present
install_python() {
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python3 already installed: $PYTHON_VERSION"
        
        # Check if version is 3.11+
        PYTHON_MINOR=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        if [[ "$PYTHON_MINOR" < "3.11" ]]; then
            print_warning "Python version is less than 3.11. Consider upgrading."
        fi
        return
    fi

    print_status "Installing Python3..."
    
    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install python@3.11
        else
            print_error "Homebrew not found. Please install Python 3.11+ manually from https://python.org"
            exit 1
        fi
    elif [[ "$OS" == "linux" ]]; then
        if command_exists apt-get; then
            # Ubuntu/Debian
            sudo apt-get update
            sudo apt-get install -y python3 python3-pip python3-venv
        elif command_exists yum; then
            # RHEL/CentOS
            sudo yum install -y python3 python3-pip
        elif command_exists dnf; then
            # Fedora
            sudo dnf install -y python3 python3-pip
        elif command_exists pacman; then
            # Arch Linux
            sudo pacman -S python python-pip
        else
            print_error "Package manager not found. Please install Python 3.11+ manually from https://python.org"
            exit 1
        fi
    else
        print_error "Unsupported OS for automatic Python installation. Please install Python 3.11+ manually from https://python.org"
        exit 1
    fi
    
    print_success "Python3 installed successfully"
}

# Install Git if not present
install_git() {
    if command_exists git; then
        GIT_VERSION=$(git --version)
        print_success "Git already installed: $GIT_VERSION"
        return
    fi

    print_status "Installing Git..."
    
    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install git
        else
            # Git should be available with Xcode Command Line Tools
            xcode-select --install 2>/dev/null || true
        fi
    elif [[ "$OS" == "linux" ]]; then
        if command_exists apt-get; then
            sudo apt-get install -y git
        elif command_exists yum; then
            sudo yum install -y git
        elif command_exists dnf; then
            sudo dnf install -y git
        elif command_exists pacman; then
            sudo pacman -S git
        else
            print_error "Package manager not found. Please install Git manually"
            exit 1
        fi
    fi
    
    print_success "Git installed successfully"
}

# Clone LocalStore repository
clone_localstore() {
    INSTALL_DIR="$HOME/localstore"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_status "LocalStore directory already exists. Updating..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        print_status "Cloning LocalStore repository..."
        git clone https://github.com/icedmoca/localstore.git "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
    
    print_success "LocalStore repository ready at $INSTALL_DIR"
}

# Install dependencies
install_dependencies() {
    print_status "Installing root dependencies..."
    npm install
    
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    print_status "Installing backend dependencies..."
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install requirements
    pip install -r requirements.txt
    
    cd ..
    
    print_success "All dependencies installed"
}

# Create startup scripts
create_startup_scripts() {
    print_status "Creating startup scripts..."
    
    # Create start script
    cat > start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Starting LocalStore..."
npm run dev
EOF
    chmod +x start.sh
    
    # Create production start script
    cat > start-prod.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Starting LocalStore in production mode..."
npm run prod
EOF
    chmod +x start-prod.sh
    
    # Create Windows batch files
    cat > start.bat << 'EOF'
@echo off
cd /d "%~dp0"
echo Starting LocalStore...
npm run dev
pause
EOF
    
    cat > start-prod.bat << 'EOF'
@echo off
cd /d "%~dp0"
echo Starting LocalStore in production mode...
npm run prod
pause
EOF
    
    print_success "Startup scripts created"
}

# Create desktop entry (Linux)
create_desktop_entry() {
    if [[ "$OS" == "linux" ]]; then
        print_status "Creating desktop entry..."
        
        DESKTOP_FILE="$HOME/.local/share/applications/localstore.desktop"
        mkdir -p "$(dirname "$DESKTOP_FILE")"
        
        cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=LocalStore
Comment=Self-hosted Python Tool Marketplace
Exec=$PWD/start.sh
Icon=$PWD/frontend/public/favicon.ico
Terminal=true
Categories=Development;IDE;
EOF
        
        print_success "Desktop entry created"
    fi
}

# Main installation function
main() {
    echo -e "${BLUE}🚀 Starting LocalStore installation...${NC}"
    echo ""
    
    # Detect OS
    detect_os
    
    # Install prerequisites
    install_git
    install_node
    install_python
    
    # Clone and setup LocalStore
    clone_localstore
    install_dependencies
    create_startup_scripts
    create_desktop_entry
    
    echo ""
    echo -e "${GREEN}🎉 LocalStore installation completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}📖 Quick Start:${NC}"
    echo -e "   Development mode:  ${BLUE}./start.sh${NC} or ${BLUE}npm run dev${NC}"
    echo -e "   Production mode:   ${BLUE}./start-prod.sh${NC} or ${BLUE}npm run prod${NC}"
    echo ""
    echo -e "${YELLOW}🌐 URLs:${NC}"
    echo -e "   Development: ${BLUE}http://localhost:3000${NC} (frontend) + ${BLUE}http://localhost:8000${NC} (backend)"
    echo -e "   Production:  ${BLUE}http://localhost:8000${NC} (everything)"
    echo ""
    echo -e "${YELLOW}📚 Documentation:${NC}"
    echo -e "   README:      ${BLUE}cat README.md${NC}"
    echo -e "   GitHub:      ${BLUE}https://github.com/icedmoca/localstore${NC}"
    echo ""
    echo -e "${GREEN}✨ Enjoy building with LocalStore!${NC}"
    
    # Offer to start immediately
    echo ""
    read -p "🚀 Start LocalStore now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Starting LocalStore in development mode...${NC}"
        npm run dev
    fi
}

# Run main function
main "$@"

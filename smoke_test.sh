#!/bin/bash

# LocalStore Smoke Test
# Comprehensive test to verify core functionality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3000
TEST_TOOL_ID="smoke-test-calculator"
LOG_FILE="smoke_test.log"

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    # Stop any running processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Remove test tool if installed
    if [ -d "tools/$TEST_TOOL_ID" ]; then
        rm -rf "tools/$TEST_TOOL_ID"
    fi
    
    # Clean test data
    if [ -f "backend/data/test_install_state.json" ]; then
        rm -f "backend/data/test_install_state.json"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Print functions
print_test() {
    echo -e "${BLUE}TEST:${NC} $1"
    log "TEST: $1"
}

print_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    log "PASS: $1"
}

print_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    log "FAIL: $1"
    exit 1
}

# Wait for service
wait_for_service() {
    local url=$1
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Start smoke test
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   LocalStore Smoke Test                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Initialize log
echo "LocalStore Smoke Test - $(date)" > "$LOG_FILE"

# Test 1: Check prerequisites
print_test "Checking prerequisites"

# Check Node.js
if ! command -v node > /dev/null; then
    print_fail "Node.js not found"
fi
NODE_VERSION=$(node -v)
print_pass "Node.js $NODE_VERSION"

# Check Python
if ! command -v python3 > /dev/null; then
    print_fail "Python3 not found"
fi
PYTHON_VERSION=$(python3 --version)
print_pass "$PYTHON_VERSION"

# Check npm packages
if [ ! -d "node_modules" ]; then
    print_fail "Node modules not installed. Run 'npm install' first"
fi
print_pass "Node modules installed"

# Check Python venv
if [ ! -d "backend/venv" ]; then
    print_fail "Python venv not found. Run install.sh first"
fi
print_pass "Python venv exists"

# Test 2: Start backend in test mode
print_test "Starting backend server"

cd backend
export FLASK_DEBUG=0
export FLASK_ENV=test
export LOCALSTORE_STATE_FILE="data/test_install_state.json"

# Start backend
source venv/bin/activate
python app.py > ../backend_test.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend
if wait_for_service "http://localhost:$BACKEND_PORT/api/health"; then
    print_pass "Backend started on port $BACKEND_PORT"
else
    print_fail "Backend failed to start (check backend_test.log)"
fi

# Test 3: Backend API endpoints
print_test "Testing backend API endpoints"

# Health check
HEALTH_RESPONSE=$(curl -s "http://localhost:$BACKEND_PORT/api/health")
if echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
    print_pass "Health check endpoint working"
else
    print_fail "Health check failed: $HEALTH_RESPONSE"
fi

# Registry endpoint
REGISTRY_RESPONSE=$(curl -s "http://localhost:$BACKEND_PORT/api/registry")
if echo "$REGISTRY_RESPONSE" | grep -q '\['; then
    print_pass "Registry endpoint working"
else
    print_fail "Registry endpoint failed"
fi

# Tools list endpoint
TOOLS_RESPONSE=$(curl -s "http://localhost:$BACKEND_PORT/api/tools")
if echo "$TOOLS_RESPONSE" | grep -q '\['; then
    print_pass "Tools list endpoint working"
else
    print_fail "Tools list endpoint failed"
fi

# Test 4: Install a tool
print_test "Installing test tool"

# Create test tool
mkdir -p "tools/$TEST_TOOL_ID"
cat > "tools/$TEST_TOOL_ID/app.py" << 'EOF'
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "healthy", "name": "Smoke Test Calculator"}

@app.get("/")
def root():
    return {"message": "Smoke test calculator working!"}
EOF

cat > "tools/$TEST_TOOL_ID/requirements.txt" << 'EOF'
fastapi==0.104.1
uvicorn==0.24.0
EOF

# Add to test registry
cat > backend/test_registry.json << EOF
[{
    "id": "$TEST_TOOL_ID",
    "name": "Smoke Test Calculator",
    "description": "Test tool for smoke testing",
    "path": "../tools/$TEST_TOOL_ID",
    "entry": "app:app"
}]
EOF

# Install via API
INSTALL_RESPONSE=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/tools/install" \
    -H "Content-Type: application/json" \
    -d "{\"id\": \"$TEST_TOOL_ID\"}")

if echo "$INSTALL_RESPONSE" | grep -q "error"; then
    print_fail "Tool installation failed: $INSTALL_RESPONSE"
else
    print_pass "Tool installed successfully"
fi

# Test 5: Start the installed tool
print_test "Starting installed tool"

START_RESPONSE=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/tools/$TEST_TOOL_ID/start")

if echo "$START_RESPONSE" | grep -q '"status":"running"'; then
    TOOL_PORT=$(echo "$START_RESPONSE" | grep -oP '"port":\K\d+')
    print_pass "Tool started on port $TOOL_PORT"
else
    print_fail "Tool failed to start: $START_RESPONSE"
fi

# Wait for tool to be ready
sleep 3

# Test 6: Access tool through proxy
print_test "Testing tool proxy access"

PROXY_RESPONSE=$(curl -s "http://localhost:$BACKEND_PORT/api/apps/$TEST_TOOL_ID/")
if echo "$PROXY_RESPONSE" | grep -q "Smoke test calculator working"; then
    print_pass "Tool accessible through proxy"
else
    print_fail "Tool proxy failed: $PROXY_RESPONSE"
fi

# Test 7: Stop the tool
print_test "Stopping tool"

STOP_RESPONSE=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/tools/$TEST_TOOL_ID/stop")
if echo "$STOP_RESPONSE" | grep -q '"status":"stopped"'; then
    print_pass "Tool stopped successfully"
else
    print_fail "Tool failed to stop: $STOP_RESPONSE"
fi

# Test 8: File operations
print_test "Testing file operations"

# List files
FILES_RESPONSE=$(curl -s "http://localhost:$BACKEND_PORT/api/tools/$TEST_TOOL_ID/files")
if echo "$FILES_RESPONSE" | grep -q "app.py"; then
    print_pass "File listing works"
else
    print_fail "File listing failed"
fi

# Read file
FILE_RESPONSE=$(curl -s "http://localhost:$BACKEND_PORT/api/tools/$TEST_TOOL_ID/file?path=app.py")
if echo "$FILE_RESPONSE" | grep -q "FastAPI"; then
    print_pass "File reading works"
else
    print_fail "File reading failed"
fi

# Write file
WRITE_RESPONSE=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/tools/$TEST_TOOL_ID/file" \
    -H "Content-Type: application/json" \
    -d '{"path": "test.txt", "content": "Smoke test content"}')
    
if echo "$WRITE_RESPONSE" | grep -q '"ok":true'; then
    print_pass "File writing works"
else
    print_fail "File writing failed"
fi

# Test 9: Delete tool
print_test "Deleting test tool"

DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:$BACKEND_PORT/api/tools/$TEST_TOOL_ID")
if echo "$DELETE_RESPONSE" | grep -q '"ok":true'; then
    print_pass "Tool deleted successfully"
else
    print_fail "Tool deletion failed"
fi

# Test 10: Frontend build
print_test "Checking frontend build"

if [ -d "backend/static" ] && [ -f "backend/static/index.html" ]; then
    print_pass "Frontend build exists"
else
    print_fail "Frontend build missing. Run 'npm run build' first"
fi

# Test 11: Production server
print_test "Testing production mode readiness"

# Check if gunicorn is installed
cd backend
source venv/bin/activate
if python -c "import gunicorn" 2>/dev/null; then
    print_pass "Gunicorn installed"
else
    print_fail "Gunicorn not installed"
fi
cd ..

# Summary
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    SMOKE TEST PASSED!                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  • Backend API: ✓"
echo "  • Tool installation: ✓"
echo "  • Tool lifecycle: ✓"
echo "  • File operations: ✓"
echo "  • Frontend build: ✓"
echo "  • Production readiness: ✓"
echo ""
echo -e "${GREEN}LocalStore is production-ready!${NC}"

# Cleanup happens automatically via trap
exit 0

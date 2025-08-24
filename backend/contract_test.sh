#!/usr/bin/env bash
set -euo pipefail

BASE="http://127.0.0.1:8000"
ID="hello-fapi"

# Helper functions
wait_for_backend() {
    echo "Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -s "$BASE/api/health" > /dev/null 2>&1; then
            echo "Backend is ready"
            return 0
        fi
        sleep 1
    done
    echo "Backend failed to start"
    exit 1
}

retry_cmd() {
    local cmd="$1"
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$cmd"; then
            return 0
        fi
        echo "Attempt $attempt failed, retrying..."
        sleep 2
        ((attempt++))
    done
    echo "Command failed after $max_attempts attempts: $cmd"
    return 1
}

# Wait for backend
wait_for_backend

echo "[health]"; curl -fsS "$BASE/api/health" | grep -q '"ok":true'

echo "[registry]"; curl -fsS "$BASE/api/registry" | tee /dev/stderr | grep -q '"id":"hello-fapi"'

echo "[clean slate]"; 
tools_result=$(curl -fsS "$BASE/api/tools")
if [[ "$tools_result" != "[]" ]]; then
    echo "Cleaning up existing tools..."
    # Try to delete existing hello-fapi if present
    curl -fsS -X DELETE "$BASE/api/tools/$ID" 2>/dev/null || true
    sleep 1
fi

echo "[install]"; 
retry_cmd "curl -fsS -X POST '$BASE/api/tools/install' -H 'content-type: application/json' -d '{\"id\":\"$ID\"}' | tee /dev/stderr | grep -q '\"status\":\"stopped\"'"

echo "[list installed]"; 
retry_cmd "curl -fsS '$BASE/api/tools' | tee /dev/stderr | grep -q '\"id\":\"$ID\"'"

echo "[start tool]"; 
retry_cmd "curl -fsS -X POST '$BASE/api/tools/$ID/start' | tee /dev/stderr | grep -q '\"status\":\"running\"'"

# Give more time for the tool to fully start and verify it's ready
sleep 3

# Wait for the tool to actually be responding on its port
echo "Waiting for tool to be ready..."
for i in {1..10}; do
    # Get the actual port from the backend
    port=$(curl -fsS "$BASE/api/tools" | grep -o '"port":[0-9]*' | head -1 | cut -d: -f2)
    if [[ -n "$port" ]] && curl -s "http://127.0.0.1:$port/" > /dev/null 2>&1; then
        echo "Tool is ready on port $port"
        break
    fi
    if [[ $i -eq 10 ]]; then
        echo "Tool failed to become ready after 10 attempts"
        exit 1
    fi
    sleep 1
done

echo "[proxy root]"; 
retry_cmd "curl -fsS '$BASE/api/apps/$ID/' | tee /dev/stderr | grep -q '\"hello\":\"world\"'"

echo "[proxy root no-slash]"; 
retry_cmd "curl -fsS '$BASE/api/apps/$ID' | tee /dev/stderr | grep -q '\"hello\":\"world\"'"

echo "[proxy ping]"; 
retry_cmd "curl -fsS '$BASE/api/apps/$ID/ping' | tee /dev/stderr | grep -q '\"pong\":true'"

echo "[logs stream]"; 
timeout 5 curl -fsS --no-buffer "$BASE/api/tools/$ID/logs" | head -5 | grep -q 'data:' && echo "Logs streaming OK"

echo "[stop tool]"; 
retry_cmd "curl -fsS -X POST '$BASE/api/tools/$ID/stop' | tee /dev/stderr | grep -q '\"status\":\"stopped\"'"

echo "[dev fork]"; 
retry_cmd "curl -fsS -X POST '$BASE/api/dev/$ID/fork' | tee /dev/stderr | grep -q '\"ok\":true'"

echo "[dev files]"; 
retry_cmd "curl -fsS '$BASE/api/dev/$ID/files' | tee /dev/stderr | grep -q '\"type\":\"dir\"'"

echo "[autostart toggle]"; 
retry_cmd "curl -fsS -X PATCH '$BASE/api/tools/$ID' -H 'content-type: application/json' -d '{\"autostart\":true}' | tee /dev/stderr | grep -q '\"ok\":true'"

echo "[runtimes list]"; 
retry_cmd "curl -fsS '$BASE/api/runtimes' | tee /dev/stderr | grep -q '\"version\":"'

echo "[uninstall]"; 
retry_cmd "curl -fsS -X DELETE '$BASE/api/tools/$ID' | tee /dev/stderr | grep -q '\"ok\":true'"

echo "[verify cleanup]"; 
sleep 1
curl -fsS "$BASE/api/tools" | tee /dev/stderr | grep -q "\[\]" && echo "Clean slate restored"

echo "✅ All contract tests passed!"

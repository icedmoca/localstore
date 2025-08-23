#!/usr/bin/env bash
set -euo pipefail

BASE="http://127.0.0.1:8000"
ID="hello-fapi"

echo "[clean]"; curl -fsS "$BASE/api/tools" | grep -q "\[\]" && echo "ok" || true

echo "[install]"; curl -fsS -X POST "$BASE/api/tools/install" -H 'content-type: application/json' -d "{\"id\":\"$ID\"}" \
  | tee /dev/stderr | grep -q '"status":"stopped"'

echo "[list]"; curl -fsS "$BASE/api/tools" | tee /dev/stderr | grep -q "\"id\":\"$ID\""

echo "[start]"; curl -fsS -X POST "$BASE/api/tools/$ID/start" | tee /dev/stderr | grep -q '"status":"running"'

echo "[proxy root]"; curl -fsS "http://127.0.0.1:8000/api/apps/$ID/" | tee /dev/stderr >/dev/null
echo "[proxy ping]"; curl -fsS "http://127.0.0.1:8000/api/apps/$ID/ping" | tee /dev/stderr >/dev/null

echo "[stop]"; curl -fsS -X POST "$BASE/api/tools/$ID/stop" | tee /dev/stderr | grep -q '"status":"stopped"'

echo "[uninstall]"; curl -fsS -X DELETE "$BASE/api/tools/$ID" | tee /dev/stderr | grep -q '"ok":true'

echo "[gone]"; curl -fsS "$BASE/api/tools" | tee /dev/stderr | grep -q "\[\]" && echo "ok"

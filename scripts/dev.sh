#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

echo "=========================================="
echo " Starting MEMORY KINGDOM..."
echo "=========================================="
echo " Backend API:   http://127.0.0.1:4000"
echo " Frontend UI:   http://localhost:5173"
echo "=========================================="

trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

(cd "$ROOT_DIR/backend/api" && npm start) &
API_PID=$!

(cd "$ROOT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

wait $API_PID $FRONTEND_PID

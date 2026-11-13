#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

echo "=========================================="
echo " MEMORY KINGDOM: Clean Build All"
echo "=========================================="

echo ">>> 1. Building C engine..."
make -C "$ROOT_DIR/backend/c-engine" clean
make -C "$ROOT_DIR/backend/c-engine" all

echo ">>> 2. Building Node.js API..."
(cd "$ROOT_DIR/backend/api" && npm run build)

echo ">>> 3. Building React frontend..."
(cd "$ROOT_DIR/frontend" && npm run build)

echo "=========================================="
echo " BUILD ALL SUCCESSFUL"
echo "=========================================="


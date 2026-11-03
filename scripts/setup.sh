#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " MEMORY KINGDOM: Environment Setup & Check"
echo "=========================================="

echo ">>> Checking OS / WSL2 environment..."
if [ -f /proc/version ]; then
    cat /proc/version
fi

if uname -r | grep -qi "microsoft-standard-WSL2"; then
    echo "WSL2 environment detected: OK"
else
    echo "Running on Linux kernel: $(uname -r)"
fi

echo ">>> Checking build-essential (gcc, make)..."
command -v gcc >/dev/null 2>&1 && gcc --version | head -n 1 || (echo "gcc missing"; exit 1)
command -v make >/dev/null 2>&1 && make --version | head -n 1 || (echo "make missing"; exit 1)

echo ">>> Checking valgrind..."
if command -v valgrind >/dev/null 2>&1; then
    valgrind --version
else
    echo "valgrind not found (ASan + UBSan will provide primary memory sanitization)"
fi

echo ">>> Checking Node.js and npm..."
export PATH="$HOME/.local/bin:$PATH"
command -v node >/dev/null 2>&1 && node --version || (echo "Node.js missing"; exit 1)
command -v npm >/dev/null 2>&1 && npm --version || (echo "npm missing"; exit 1)

echo ">>> Installing backend API dependencies..."
(cd "$(dirname "$0")/../backend/api" && npm install --no-fund --no-audit)

echo ">>> Installing frontend dependencies..."
(cd "$(dirname "$0")/../frontend" && npm install --no-fund --no-audit)

echo "=========================================="
echo " MEMORY KINGDOM SETUP COMPLETE"
echo "=========================================="

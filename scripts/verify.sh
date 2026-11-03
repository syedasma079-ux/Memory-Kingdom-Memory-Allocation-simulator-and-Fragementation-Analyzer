#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=========================================="
echo " MEMORY KINGDOM: Global Verification Suite"
echo "=========================================="

echo ">>> 1. Verifying golden files against golden-lock..."
git diff --exit-code golden-lock -- backend/c-engine/tests/golden
echo "Golden lock check: PASSED (fixtures untouched)"

echo ">>> 2. Single-source-of-truth verification..."
./scripts/check-single-source.sh

echo ">>> 3. Compiling and verifying C Engine Core & Linux Mode..."
make -C backend/c-engine clean
make -C backend/c-engine check

echo ">>> 4. Verifying Node.js / Express API..."
export PATH="$HOME/.local/bin:$PATH"
(cd backend/api && npm test)
(cd backend/api && npx tsx scripts/drive-assignment.ts)

echo "=========================================="
echo " ALL VERIFICATION CHECKS PASSED           "
echo "=========================================="


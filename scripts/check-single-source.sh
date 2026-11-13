#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Running Single Source of Truth Checks ==="

# Check 1: No file outside arena.c, mab.c, tests/ calls memFree, memMerge, memSplit
VIOLATIONS=$(grep -rnE "\b(memFree|memMerge|memSplit)\b" \
  --exclude-dir=tests \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.git \
  --exclude="arena.c" \
  --exclude="mab.c" \
  --exclude="mab.h" \
  --exclude="*.md" \
  --exclude="*.o" \
  --exclude="*.a" \
  --exclude="memk-*" \
  --exclude="scheduler-tests*" \
  --exclude="protocol-fuzz*" \
  --exclude="linux-mode-tests*" \
  --exclude="check-single-source.sh" \
  backend/ frontend/ || true)

if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: Unauthorized calls to memFree, memMerge, or memSplit found:"
  echo "$VIOLATIONS"
  exit 1
fi

# Check 2: No allocation-like logic in backend/api or frontend/src
API_FRONTEND_VIOLATIONS=$(grep -rnEi "\b(firstFit|bestFit|nextFit|worstFit|memAlloc|memChk|memSplit|memMerge)\b" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude="*.md" \
  backend/api/ frontend/src/ 2>/dev/null || true)

# Filter out legitimate API/UI strings like policy names "first_fit", UI labels, etc.
# We flag function definitions or allocation algorithms implemented in JS/TS
ALGO_DEF_VIOLATIONS=$(grep -rnE "(function\s+(firstFit|bestFit|nextFit|worstFit|allocBlock|splitBlock|mergeBlock)|const\s+(firstFit|bestFit|nextFit|worstFit)\s*=\s*\()" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  backend/api/ frontend/src/ 2>/dev/null || true)

if [ -n "$ALGO_DEF_VIOLATIONS" ]; then
  echo "FAIL: Allocation algorithm logic implemented in Node API or Frontend:"
  echo "$ALGO_DEF_VIOLATIONS"
  exit 1
fi

echo "Single source of truth checks PASSED."
exit 0

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

if grep -rnE "#[0-9a-fA-F]{3,6}\b" frontend/src/pages frontend/src/components \
  | grep -vE "frontend/src/theme|styles/index.css" >/dev/null; then
  grep -rnE "#[0-9a-fA-F]{3,6}\b" frontend/src/pages frontend/src/components | head -5
  fail "存在写死的十六进制色值"
else
  pass "无写死色值"
fi

exit $FAIL

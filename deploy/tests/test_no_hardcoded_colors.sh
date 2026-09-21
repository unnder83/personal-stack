#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

# 页面、组件与 App 外壳不得出现写死颜色（十六进制 / rgba / hsl）；
# 颜色常量只允许存在于 src/theme。
if grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" \
  frontend/src/pages frontend/src/components frontend/src/App.tsx >/dev/null; then
  grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" \
    frontend/src/pages frontend/src/components frontend/src/App.tsx | head -5
  fail "存在写死的颜色值"
else
  pass "页面与组件无写死颜色"
fi

exit $FAIL

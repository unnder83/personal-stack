#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

if python3 - <<'PYEOF'
import pathlib
import re
import sys

text = "\n".join(p.read_text() for p in pathlib.Path("backend/app/modules").glob("*/router.py"))
prefixes = set(re.findall(r'prefix="(/api[^"]*)"', text))
doc = pathlib.Path("docs/api-reference.md").read_text()
missing = sorted(prefix for prefix in prefixes if prefix not in doc)
if missing:
    print("缺失前缀：", missing, file=sys.stderr)
    sys.exit(1)
print(f"接口前缀覆盖 {len(prefixes)} 个")
PYEOF
then
  pass "API 手册覆盖全部路由前缀"
else
  fail "API 手册缺路由前缀"
fi

grep -q "错误响应" docs/api-reference.md && pass "手册含错误响应约定" || fail "缺错误响应约定"
grep -q "curl 示例集" docs/api-reference.md && pass "手册含 curl 示例" || fail "缺 curl 示例"

exit $FAIL

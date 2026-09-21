#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

[ -f deploy/monitoring/prometheus.yml ] && pass "prometheus.yml 存在" || fail "缺 prometheus.yml"
grep -q 'job_name: api' deploy/monitoring/prometheus.yml && pass "抓取 api" || fail "未抓取 api"
python3 -c 'import json; json.load(open("deploy/monitoring/grafana/dashboards/host.json"))' && pass "大盘 JSON 合法" || fail "大盘 JSON 非法"
grep -q 'profiles: \["monitoring"\]' deploy/compose.yaml && pass "compose 有 monitoring profile" || fail "缺 monitoring profile"
grep -q 'basic_auth' deploy/Caddyfile && pass "Grafana 有 basic auth" || fail "缺 basic auth"
grep -q "header_up -Authorization" deploy/Caddyfile && pass "Grafana 代理剥离 Authorization" || fail "Grafana 代理未剥离 Authorization"
grep -q 'Strict-Transport-Security' deploy/Caddyfile && pass "有 HSTS" || fail "缺 HSTS"
grep -q 'Content-Security-Policy' deploy/Caddyfile && pass "有 CSP" || fail "缺 CSP"
grep -q 'ENABLE_MONITORING' deploy/ops/deploy-release.sh && pass "脚本支持监控开关" || fail "脚本缺监控开关"

python3 - <<'PYEOF'
import re

text = open("deploy/Caddyfile").read()
grafana_block = re.search(r"handle /grafana/\*\s*\{(.*?)\n\t\}", text, flags=re.S)
assert grafana_block and "Content-Security-Policy" not in grafana_block.group(1)
PYEOF
[ $? -eq 0 ] && pass "grafana 路由不套 CSP" || fail "grafana 路由含 CSP"

exit $FAIL

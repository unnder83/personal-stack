#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

grep -q 'image: ${API_IMAGE}' deploy/compose.yaml && pass "compose 使用 API_IMAGE" || fail "compose 未使用 API_IMAGE"
grep -q 'image: ${WEB_IMAGE}' deploy/compose.yaml && pass "compose 使用 WEB_IMAGE" || fail "compose 未使用 WEB_IMAGE"
if grep -q 'build:' deploy/compose.yaml; then
  fail "compose 仍含 build:"
else
  pass "compose 不含 build:"
fi
bash -n deploy/ops/deploy-release.sh && pass "deploy-release.sh 语法" || fail "deploy-release.sh 语法"
grep -q 'API_IMAGE=.*\$SHA' deploy/ops/deploy-release.sh && pass "镜像按 sha 打标" || fail "镜像未按 sha 打标"
grep -q 'readlink -f' deploy/ops/deploy-release.sh && pass "记录上一 release" || fail "未记录上一 release"
grep -q 'alembic upgrade head' deploy/ops/deploy-release.sh && pass "含迁移" || fail "缺迁移步骤"
grep -q 'health_ok' deploy/ops/deploy-release.sh && pass "含健康检查函数" || fail "缺健康检查"
grep -q 'rollback()' deploy/ops/deploy-release.sh && pass "含回滚函数" || fail "缺回滚函数"
grep -q 'trap ' deploy/ops/deploy-release.sh && pass "含信号回滚 trap" || fail "缺信号 trap"
grep -q 'can_rollback' deploy/ops/deploy-release.sh && pass "含回滚前置检查" || fail "缺回滚前置检查"
grep -q 'compose_for "$RELEASE" config' deploy/ops/deploy-release.sh && pass "切换前 compose config 预检" || fail "缺 compose 预检"
grep -q 'http://localhost/api/health' deploy/ops/deploy-release.sh && pass "健康检查经 Caddy 路由" || fail "健康检查未走 Caddy"
grep -q 'personal-stack' deploy/ops/deploy-release.sh && pass "显式指定 compose 项目名" || fail "未显式指定项目名"
if grep -q '^name:' deploy/compose.yaml; then
  fail "compose.yaml 顶层不应固定 name（防误伤生产）"
else
  pass "compose.yaml 未固定 name"
fi

# workflow 不变量
if grep -q 'uses:' .github/workflows/deploy.yml; then
  fail "deploy.yml 不应含 uses:"
else
  pass "deploy.yml 无 uses:"
fi
grep -q 'concurrency:' .github/workflows/deploy.yml && pass "deploy.yml 含 concurrency" || fail "deploy.yml 缺 concurrency"
grep -q 'timeout-minutes:' .github/workflows/deploy.yml && pass "deploy.yml 含超时" || fail "deploy.yml 缺超时"
grep -q 'commits/main' .github/workflows/deploy.yml && pass "deploy.yml 含 main-head 门禁" || fail "deploy.yml 缺 main-head 门禁"

exit $FAIL

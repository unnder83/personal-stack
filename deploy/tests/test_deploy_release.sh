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

exit $FAIL

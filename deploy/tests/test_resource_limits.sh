#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

# 基础镜像必须按 digest 固定
grep -qE '^FROM python:3\.12-slim@sha256:[0-9a-f]{64}' backend/Dockerfile \
  && pass "后端基础镜像 digest 固定" || fail "后端基础镜像未固定 digest"
grep -qE '^FROM node:22\.23-alpine@sha256:[0-9a-f]{64}' frontend/Dockerfile \
  && pass "node 基础镜像 digest 固定" || fail "node 未固定 digest"
grep -qE '^FROM nginx:1\.27\.5-alpine@sha256:[0-9a-f]{64}' frontend/Dockerfile \
  && pass "nginx 基础镜像 digest 固定" || fail "nginx 未固定 digest"

# CI 与开发编排里的 MySQL 必须是小版本（不能是浮动的 8.0）
if grep -qE 'image: mysql:8\.0[[:space:]]*$' .github/workflows/ci.yml; then
  fail "CI 的 mysql 未固定小版本"
else
  pass "CI 的 mysql 固定小版本"
fi
grep -qE 'image: mysql:8\.0\.[0-9]+' .github/workflows/ci.yml \
  && pass "CI mysql 小版本存在" || fail "CI mysql 小版本缺失"
if grep -qE 'image: mysql:8\.0[[:space:]]*$' deploy/compose.dev.yaml; then
  fail "开发编排的 mysql 未固定小版本"
else
  pass "开发编排 mysql 固定小版本"
fi
grep -qE 'image: mysql:8\.0\.[0-9]+@sha256:' deploy/compose.yaml \
  && pass "生产 mysql 版本+digest 固定" || fail "生产 mysql 未固定"

# 生产每个服务都要有内存上限；入口服务降低 OOM 优先级
SERVICE_COUNT=$(awk '/^services:/{inside=1; next} /^[a-z]/{inside=0} inside && /^  [a-z][a-z0-9-]*:$/{count++} END{print count+0}' deploy/compose.yaml)
LIMIT_COUNT=$(awk '/^services:/{inside=1; next} /^[a-z]/{inside=0} inside && /^    mem_limit:/{count++} END{print count+0}' deploy/compose.yaml)
if [ "$SERVICE_COUNT" -gt 0 ] && [ "$SERVICE_COUNT" -eq "$LIMIT_COUNT" ]; then
  pass "全部 $SERVICE_COUNT 个服务都有 mem_limit"
else
  fail "mem_limit 不完整（服务 $SERVICE_COUNT 个，上限 $LIMIT_COUNT 个）"
fi
if awk '/^  caddy:$|^  cloudflared:$/{found=1; next} /^  [a-z][a-z0-9-]*:$/{found=0} found && /oom_score_adj: -[0-9]+/{ok++} END{exit (ok==2)?0:1}' deploy/compose.yaml; then
  pass "入口服务设置负 oom_score_adj"
else
  fail "入口服务缺少负 oom_score_adj"
fi

exit $FAIL

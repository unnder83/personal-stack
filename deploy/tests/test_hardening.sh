#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

grep -q 'no-new-privileges' deploy/compose.yaml && pass "compose 有 no-new-privileges" || fail "缺 no-new-privileges"
grep -c 'cap_drop: \[ALL\]' deploy/compose.yaml | grep -qE '^[4-9]$' && pass "4+ 服务 cap_drop" || fail "cap_drop 数量不足"
grep -c 'read_only: true' deploy/compose.yaml | grep -qE '^[4-9]$' && pass "4+ 服务 read_only" || fail "read_only 数量不足"
grep -q 'Strict-Transport-Security' deploy/Caddyfile && pass "HSTS 存在" || fail "缺 HSTS"
grep -q 'Content-Security-Policy' deploy/Caddyfile && pass "CSP 存在" || fail "缺 CSP"
grep -qE '^FROM node:22\.23-alpine@sha256:' frontend/Dockerfile && pass "node 基镜像 digest 固定" || fail "node 未固定 digest"
grep -qE '^FROM nginx:1\.27\.5-alpine@sha256:' frontend/Dockerfile && pass "nginx 基镜像 digest 固定" || fail "nginx 未固定 digest"
grep -qE 'prom/prometheus:v3\.1\.0@sha256:' deploy/compose.yaml && pass "prometheus digest 固定" || fail "prometheus 未固定"
grep -qE 'mysql:8\.0\.46@sha256:' deploy/compose.yaml && pass "mysql digest 固定" || fail "mysql 未固定"

exit $FAIL

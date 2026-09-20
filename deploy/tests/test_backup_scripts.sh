#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; FAIL=1; }

for script in deploy/ops/backup/backup-db.sh deploy/ops/backup/backup-files.sh deploy/ops/systemd/install-backup-timer.sh; do
  bash -n "$script" && pass "$script 语法" || fail "$script 语法"
done
grep -q 'single-transaction' deploy/ops/backup/backup-db.sh && pass "dump 使用单事务" || fail "缺 --single-transaction"
grep -q 'mtime +7' deploy/ops/backup/backup-db.sh && pass "日备保留 7 天" || fail "缺日备保留策略"
grep -q 'mtime +28' deploy/ops/backup/backup-db.sh && pass "周备保留 4 周" || fail "缺周备保留策略"
grep -q 'rsync -a --delete' deploy/ops/backup/backup-files.sh && pass "文件为镜像同步" || fail "缺 rsync --delete"
grep -q 'OnCalendar' deploy/ops/systemd/personal-stack-backup.timer && pass "timer 有调度" || fail "缺 OnCalendar"
grep -q 'Persistent=true' deploy/ops/systemd/personal-stack-backup.timer && pass "timer 支持错过补跑" || fail "缺 Persistent"

exit $FAIL

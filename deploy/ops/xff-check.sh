#!/usr/bin/env bash
# 公网路径的 X-Forwarded-For 回归验证：
# 伪造 XFF 不应改变登录限流的桶（证明客户端无法借 XFF 绕过或转移限流）。
#
# 用法：HOST=stack.personal-stack.ltd bash deploy/ops/xff-check.sh
# 需要 HOST 可从本机解析（本机 DNS 不解析公网域名时，先加 /etc/hosts 指向边缘 IP）。
set -euo pipefail

HOST="${HOST:?用法：HOST=<主机名> bash deploy/ops/xff-check.sh}"
URL="https://$HOST/api/auth/login"
SPOOF_A="198.51.100.201"
SPOOF_B="198.51.100.202"

attempt() {
  local spoof="$1"
  curl -sS -o /tmp/xff-check.out -w '%{http_code}' -X POST "$URL" \
    -H 'Content-Type: application/json' \
    -H "X-Forwarded-For: $spoof" \
    -d '{"username":"admin","password":"definitely-wrong"}'
}

echo "同一真实出口 IP，伪造 XFF=$SPOOF_A 连续失败 6 次（第 6 次应为 429）"
for _ in 1 2 3 4 5 6; do
  printf '  attempt: %s\n' "$(attempt "$SPOOF_A")"
done

echo "换一个伪造 XFF=$SPOOF_B（真实 IP 未变，应仍为 429）"
status="$(attempt "$SPOOF_B")"
printf '  attempt: %s\n' "$status"

if [ "$status" = "429" ]; then
  echo "PASS：伪造 XFF 无法转移限流桶（公网路径）"
else
  echo "FAIL：伪造 XFF 改变了限流桶，请检查 Caddy trusted_proxies_strict 与 uvicorn 转发配置" >&2
  exit 1
fi

rm -f /tmp/xff-check.out

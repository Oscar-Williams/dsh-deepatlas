#!/usr/bin/env bash
# Distribution E2E(评审第六轮②):验证"用户实际拿到的分发物"
# 本地(WSL/bash)与 GitHub Actions 共用同一脚本,消除 CI 专有差异。
# 用法:bash scripts/verify-distribution.sh [DSH_BIN]
#   DSH_BIN:dsh 可执行文件路径;缺省尝试全局 dsh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DSH="${1:-$(command -v dsh || true)}"
[ -n "$DSH" ] || { echo "未找到 dsh(先 npm i -g @deepseek-ai/dsh 或传入路径)"; exit 1; }

DIST="$(mktemp -d /tmp/deepatlas-dist-XXXX)"
export DSH_HOME="$(mktemp -d /tmp/deepatlas-home-XXXX)"
PORT="${DEEPATLAS_VERIFY_PORT:-3085}"
echo "[1/4] 构造分发物(git archive → npm pack tarball,安装语义=用户真实安装)"
# 注:不能用目录 link: 安装——pnpm 对 link: 不装 dependencies,语义与
# github:/registry 安装不同(2026-08-23 实测);tarball 才是忠实等价物。
git -C "$ROOT" archive HEAD | tar -x -C "$DIST"
TGZ="$(cd "$DIST" && npm pack --silent 2>/dev/null)"
[ -n "$TGZ" ] || { echo "FAIL: npm pack"; exit 1; }
echo "  tarball: $TGZ"

echo "[2/4] 全新 DSH_HOME=$DSH_HOME 安装 tarball"
"$DSH" plugin --profile web add "$DIST/$TGZ" || { echo "FAIL: plugin add"; exit 1; }

echo "[3/4] 组合验证(dump-config 断言)"
DUMP="$("$DSH" --profile web --dump-config)" || { echo "FAIL: dump-config"; exit 1; }
echo "$DUMP" | grep -A2 "== dsh-deepatlas" || { echo "FAIL: 组合树未见 deepatlas"; exit 1; }

echo "[4/4] 启动冒烟(HTTP 200,最长 120s)"
("$DSH" web --port "$PORT" --no-open > "$DSH_HOME/boot.log" 2>&1 &)
for i in $(seq 1 24); do
  sleep 5
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$PORT" || true)"
  if [ "$code" = "200" ]; then echo "OK: t=$((i*5))s HTTP 200 —— Distribution E2E 通过"; exit 0; fi
done
echo "FAIL: boot smoke(120s 未探活),日志:"
tail -15 "$DSH_HOME/boot.log"
exit 1

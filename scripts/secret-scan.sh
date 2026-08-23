#!/usr/bin/env bash
# RC1 密钥扫描:工作区(已跟踪+未跟踪未忽略)+ git 全历史
# 排除:扫描器自身(含已知指纹常量)、gitignored 本地产物(如 .ssh-deploy)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SELF='scripts/secret-scan.sh'
PATTERNS='ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|sk-[a-f0-9]{32}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,}'
FAIL=0

echo "[1/3] 工作区扫描(已跟踪 + 未跟踪未忽略;排除扫描器与 gitignored)"
FILES="$( { git ls-files; git ls-files --others --exclude-standard; } | grep -v "^$SELF\$" | grep -v "^\.ssh-deploy/" || true )"
if [ -n "$FILES" ] && echo "$FILES" | xargs grep -nIE "$PATTERNS" 2>/dev/null; then
  echo "FAIL: 工作区发现疑似密钥"; FAIL=1
else
  echo "  干净"
fi

echo "[2/3] git 全历史扫描"
if git log --all -p | grep -nE "$PATTERNS" | head -20 | grep -q .; then
  echo "FAIL: 历史提交中发现疑似密钥"; FAIL=1
else
  echo "  干净"
fi

echo "[3/3] 已知凭据指纹核查(历史+工作区,排除扫描器常量自身)"
KNOWN1="sk-f9607e"; KNOWN2="ghp_vJ6B"
for K in "$KNOWN1" "$KNOWN2"; do
  if git log --all -p | grep -q "$K"; then echo "FAIL: 已知密钥 $K… 入库"; FAIL=1; fi
  if [ -n "$FILES" ] && echo "$FILES" | xargs grep -l "$K" 2>/dev/null | grep -q .; then echo "FAIL: 已知密钥 $K… 在工作区"; FAIL=1; fi
done
echo "  已知指纹核查完成"

[ "$FAIL" = "0" ] && echo "SECRET SCAN PASS" || { echo "SECRET SCAN FAIL"; exit 1; }

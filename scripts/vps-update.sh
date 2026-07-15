#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Reset dist conflicts"
git checkout -- dist/index.html dist/assets/ 2>/dev/null || true
rm -f dist/assets/index-*.js dist/assets/index-*.css dist/assets/web-*.js 2>/dev/null || true
# Không xóa start/stop scripts — cần cho aaPanel keeper

echo "==> Pull latest code"
git pull origin main

echo "==> Verify commit"
git log -1 --oneline

echo "==> Build frontend"
npm run build

echo "==> Verify dist bundle integrity"
JS="$(grep -oE 'assets/index-[^"]+\.js' dist/index.html | head -1 | sed 's|^assets/||')"
CSS="$(grep -oE 'assets/index-[^"]+\.css' dist/index.html | head -1 | sed 's|^assets/||')"
if [ -z "$JS" ]; then
  echo "ERROR: Cannot find main JS bundle in dist/index.html"
  exit 1
fi
if [ ! -f "dist/assets/$JS" ]; then
  echo "ERROR: dist/index.html references dist/assets/$JS but file is missing!"
  echo "Run: npm run build"
  exit 1
fi
if [ -n "$CSS" ] && [ ! -f "dist/assets/$CSS" ]; then
  echo "ERROR: dist/index.html references dist/assets/$CSS but file is missing!"
  exit 1
fi

echo "OK: dist/assets/$JS ($(du -h "dist/assets/$JS" | cut -f1))"
echo "OK: dist/index.html points to $JS"

echo "Done."
echo "→ aaPanel: Project File = server/keeper.js (bắt buộc), Memory Limit ≥ 1024M hoặc để trống."
echo "→ Cron 1 phút: bash /www/wwwroot/crm-iqi/scripts/watchdog-crm.sh"
echo "→ Start project → Hard-refresh (Ctrl+F5)."
echo "→ Check: curl -s https://YOUR_DOMAIN/api/version"

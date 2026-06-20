#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Reset dist conflicts"
git checkout -- dist/index.html 2>/dev/null || true
rm -f scripts/clean-backups.sh scripts/start-server.sh scripts/stop-server.sh

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

echo "Done. Restart Node app in aaPanel, then hard-refresh browser (Ctrl+F5)."

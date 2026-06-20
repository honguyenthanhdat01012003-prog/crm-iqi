#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Reset dist conflicts"
git checkout -- dist/index.html 2>/dev/null || true
rm -f scripts/clean-backups.sh scripts/start-server.sh scripts/stop-server.sh

echo "==> Pull latest code"
git pull origin main

echo "==> Verify fix commit + leadStatusUtils"
git log -1 --oneline
test -f src/utils/leadStatusUtils.js

echo "==> Build frontend"
npm run build

echo "==> Deploy bundle"
JS="$(grep -o 'index-[^"]*\.js' dist/index.html | head -1)"
echo "Bundle: dist/assets/$JS"
grep -q 'getLeadTabStatus\|normalizeLeadStatusKey' "dist/assets/$JS" || echo "WARN: status utils may be tree-shaken (minified) — check git log instead"

echo "Done. Restart Node app in aaPanel, then hard-refresh browser (Ctrl+F5)."

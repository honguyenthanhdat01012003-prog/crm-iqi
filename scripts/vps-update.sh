#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-4000}"
EXPECTED_VERSION_PREFIX="2026-07-16-autosync-60s"

echo "==> Reset dist conflicts"
git checkout -- dist/index.html dist/assets/ 2>/dev/null || true
rm -f dist/assets/index-*.js dist/assets/index-*.css dist/assets/web-*.js 2>/dev/null || true

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
  exit 1
fi
if [ -n "$CSS" ] && [ ! -f "dist/assets/$CSS" ]; then
  echo "ERROR: dist/index.html references dist/assets/$CSS but file is missing!"
  exit 1
fi

echo "OK: dist/assets/$JS ($(du -h "dist/assets/$JS" | cut -f1))"

echo "==> Force restart Node (keeper) on :$PORT"
# Kill mọi process đang giữ port — aaPanel Stop đôi khi không đổi code đang chạy
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
else
  PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
fi
pkill -f "server/keeper.js" 2>/dev/null || true
pkill -f "server/index.js" 2>/dev/null || true
sleep 2

export NODE_MAX_OLD_SPACE_SIZE="${NODE_MAX_OLD_SPACE_SIZE:-640}"
export PORT
mkdir -p "$ROOT/server/data"
nohup node server/keeper.js >> "$ROOT/server/data/keeper.out" 2>&1 &
echo "started keeper pid=$!"
sleep 3

echo "==> Verify live version"
VER_JSON="$(curl -s --max-time 8 "http://127.0.0.1:${PORT}/api/version" || true)"
echo "$VER_JSON"
if echo "$VER_JSON" | grep -q "$EXPECTED_VERSION_PREFIX"; then
  echo "OK: live version matches $EXPECTED_VERSION_PREFIX*"
else
  echo "WARN: version chưa đúng — aaPanel có thể đang spawn process khác."
  echo "→ aaPanel Node project: Stop, Project File = server/keeper.js, rồi Start."
fi

SHEET_JSON="$(curl -s --max-time 25 "http://127.0.0.1:${PORT}/api/health/sheet" || true)"
echo "==> Sheet health:"
echo "$SHEET_JSON"

echo "Done. Hard-refresh CRM (Ctrl+F5)."
echo "Public check: curl -s https://crm-iqi.id.vn/api/version"
echo "Expect version: 2026-07-16-autosync-60s-l"

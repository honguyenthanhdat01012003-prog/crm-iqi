#!/bin/bash
# aaPanel Start script — hoặc dùng server/keeper.js làm Project File.
# Tự dọn port rồi chạy keeper (auto-restart khi crash/OOM).
cd /www/wwwroot/crm-iqi || cd "$(dirname "$0")/.."

PORT="${PORT:-4000}"

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
else
  PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
fi

sleep 1
export NODE_MAX_OLD_SPACE_SIZE="${NODE_MAX_OLD_SPACE_SIZE:-768}"
exec node server/keeper.js

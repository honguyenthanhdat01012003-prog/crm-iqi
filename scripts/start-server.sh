#!/bin/bash
# aaPanel Start: tự dọn port 4000 rồi chạy Node (1 process duy nhất để Stop hoạt động)
set -e
cd /www/wwwroot/crm-iqi

PORT="${PORT:-4000}"

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
else
  PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
fi

sleep 1
exec node server/index.js

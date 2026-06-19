#!/bin/bash
# Tắt CRM backend — chạy SAU KHI bấm Stop trong aaPanel
PORT="${PORT:-4000}"

for attempt in 1 2 3; do
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
  fi
  PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
  pkill -9 -f "/www/wwwroot/crm-iqi/server/index.js" 2>/dev/null || true
  sleep 1
  lsof -i:"$PORT" 2>/dev/null | grep -q node || break
done

if lsof -i:"$PORT" 2>/dev/null | grep -q node; then
  echo "[stop-server] FAILED — port $PORT still in use:"
  lsof -i:"$PORT"
  echo "→ Bấm Stop trong aaPanel Node trước, rồi chạy lại script này."
  exit 1
fi

echo "[stop-server] OK — port $PORT is free."

#!/usr/bin/env bash
# aaPanel Cron (mỗi 1 phút):
#   bash /www/wwwroot/crm-iqi/scripts/watchdog-crm.sh
# Nếu API không trả lời → restart keeper (khôi phục khi panel hiện Stopped).

set -uo pipefail

ROOT="/www/wwwroot/crm-iqi"
PORT="${PORT:-4000}"
LOG="$ROOT/server/data/watchdog.log"
KEEPALIVE_URL="${KEEPALIVE_URL:-http://127.0.0.1:${PORT}/api/version}"

mkdir -p "$(dirname "$LOG")"
ts() { date '+%Y-%m-%d %H:%M:%S'; }

ok=0
if command -v curl >/dev/null 2>&1; then
  if curl -sf --max-time 4 "$KEEPALIVE_URL" >/dev/null 2>&1; then
    ok=1
  fi
elif command -v wget >/dev/null 2>&1; then
  if wget -q -T 4 -O /dev/null "$KEEPALIVE_URL" 2>/dev/null; then
    ok=1
  fi
fi

if [ "$ok" = "1" ]; then
  exit 0
fi

echo "$(ts) CRM down on :$PORT — restarting keeper" >> "$LOG"

cd "$ROOT" || exit 1

# Dọn process cũ trên port
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
else
  PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
fi
sleep 1

export NODE_MAX_OLD_SPACE_SIZE="${NODE_MAX_OLD_SPACE_SIZE:-640}"
export PORT

# Chạy nền — không phụ thuộc trạng thái Start/Stop của aaPanel UI
nohup node server/keeper.js >> "$ROOT/server/data/keeper.out" 2>&1 &
echo "$(ts) started keeper pid=$!" >> "$LOG"
exit 0

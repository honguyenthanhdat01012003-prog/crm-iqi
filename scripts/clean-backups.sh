#!/bin/bash
# Chạy thủ công hoặc cron mỗi 10 phút: */10 * * * * bash /www/wwwroot/crm-iqi/scripts/clean-backups.sh
BACKUP_DIR="/www/wwwroot/crm-iqi/server/data/backups"
KEEP=5
[ -d "$BACKUP_DIR" ] || exit 0
COUNT=$(ls "$BACKUP_DIR"/crm_*.db 2>/dev/null | wc -l)
if [ "$COUNT" -le "$KEEP" ]; then exit 0; fi
ls -t "$BACKUP_DIR"/crm_*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "[clean-backups] trimmed to $KEEP files (was $COUNT)"

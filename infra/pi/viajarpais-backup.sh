#!/bin/bash
# Backup off-site de la DB de viajarpais (contenedor viajarpais-db).
# pg_dump consistente + restic al repo de respaldo del homelab (.38),
# tag 'viajarpais'. Mismo esquema que pulsia-offsite-backup.sh: avisa por
# Telegram y deja estado en disco.
#
# Se instala en la Pi como /usr/local/sbin/viajarpais-backup.sh (root:root,
# 0750) y lo dispara viajarpais-backup.timer. Ver infra/pi/README.md.
set -euo pipefail

export RESTIC_PASSWORD_FILE=/root/.restic-password
export RESTIC_REPOSITORY="sftp:kilo@192.168.178.38:/mnt/backup/restic-repo"
export HOME=/root
DBC=viajarpais-db
DUMPDIR=/var/backups/viajarpais
DUMP="$DUMPDIR/viajarpais.dump"
STATUS="$DUMPDIR/last-backup.status"
CREDS=/root/.telegram-creds
NOTIFY_OK=1
STEP="init"; DONE=0

LOG(){ echo "[$(date '+%F %T')] $*"; }

notify(){
  [ -f "$CREDS" ] || { echo "notify: no $CREDS"; return 0; }
  local token chat
  token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$CREDS" | head -1 | cut -d= -f2-)"
  chat="$(grep -E '^TELEGRAM_CHAT_ID=' "$CREDS" | head -1 | cut -d= -f2-)"
  [ -n "$token" ] && [ -n "$chat" ] || { echo "notify: faltan creds"; return 0; }
  curl -s --max-time 20 -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${chat}" --data-urlencode "text=$1" >/dev/null \
    || echo "notify: curl fallo"
}

on_exit(){
  local rc=$?
  if [ "$DONE" != 1 ]; then
    mkdir -p "$DUMPDIR" 2>/dev/null || true
    printf 'FAIL %s step=%s rc=%s\n' "$(date -Is)" "$STEP" "$rc" > "$STATUS" 2>/dev/null || true
    notify "🔴 Backup viajarpais DB FALLO (paso: ${STEP}, rc=${rc}) en $(hostname). Revisar."
  fi
}
trap on_exit EXIT

STEP="pg_dump"; LOG "pg_dump de $DBC"
mkdir -p "$DUMPDIR"; chmod 700 "$DUMPDIR"
# Formato custom (restaurable con pg_restore, selectivo por tabla) sin
# compresion (-Z0): restic deduplica y comprime mejor el dump crudo.
# Se escribe a .tmp y se renombra, asi un dump cortado nunca pisa al bueno.
docker exec "$DBC" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z0 --no-owner --no-acl' > "$DUMP.tmp"
[ -s "$DUMP.tmp" ] || { echo "dump vacio"; exit 1; }
# sanity: el dump tiene que ser legible por pg_restore
docker exec -i "$DBC" pg_restore --list < "$DUMP.tmp" > /dev/null
mv "$DUMP.tmp" "$DUMP"
DUMPSZ="$(du -h "$DUMP" | cut -f1)"
LOG "dump listo: $DUMPSZ"

STEP="restic-backup"; LOG "restic backup (tag viajarpais)"
restic backup "$DUMPDIR" --tag viajarpais

STEP="restic-forget"; LOG "retencion (14d/8w/12m) + prune"
restic forget --tag viajarpais --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune

STEP="done"
SNAP="$(restic snapshots --tag viajarpais --latest 1 2>/dev/null | tail -3 | head -1)"
DONE=1
printf 'OK %s dump=%s\n' "$(date -Is)" "$DUMPSZ" > "$STATUS" 2>/dev/null || true
LOG "FIN OK"
[ "$NOTIFY_OK" = 1 ] && notify "🟢 Backup viajarpais DB OK en $(hostname). Dump: ${DUMPSZ}. Ultimo snapshot: ${SNAP}"
exit 0

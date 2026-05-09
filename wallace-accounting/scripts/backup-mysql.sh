#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/mysql}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [ -f ".env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

MYSQL_DATABASE="${MYSQL_DATABASE:-wallace_accounting}"
MYSQL_USER="${MYSQL_USER:-wallace}"

if [ -z "${MYSQL_PASSWORD:-}" ]; then
  echo "MYSQL_PASSWORD is required. Set it in .env.production or the environment." >&2
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/${MYSQL_DATABASE}-${TIMESTAMP}.sql.gz"

docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysqldump \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  -u"$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" \
  "$MYSQL_DATABASE" | gzip > "$BACKUP_FILE"

find "$BACKUP_DIR" -type f -name "${MYSQL_DATABASE}-*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backup written to $BACKUP_FILE"

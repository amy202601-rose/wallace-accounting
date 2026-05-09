#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 path/to/backup.sql.gz" >&2
  exit 1
fi

BACKUP_FILE="$1"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

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

gzip -dc "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysql \
  -u"$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" \
  "$MYSQL_DATABASE"

echo "Restored $BACKUP_FILE into $MYSQL_DATABASE"

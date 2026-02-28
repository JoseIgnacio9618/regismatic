#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR=${1:-./backups}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$OUTPUT_DIR"
OUT_FILE="$OUTPUT_DIR/regismatic_$TIMESTAMP.sql.gz"

POSTGRES_DB=${POSTGRES_DB:-regismatic}
POSTGRES_USER=${POSTGRES_USER:-regismatic}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

if ! docker compose ps db >/dev/null 2>&1; then
  echo "db service is not running in docker compose"
  exit 1
fi

docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$OUT_FILE"

echo "Backup generated: $OUT_FILE"

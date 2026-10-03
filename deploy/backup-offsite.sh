#!/bin/bash
# Run from a protected host checkout. rclone remote credentials stay on the host.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${BACKUP_DIR:?Set the absolute backup directory}"
: "${BACKUP_REMOTE:?Set a dedicated rclone remote:path}"
[[ "$BACKUP_DIR" = /* ]] || { echo 'BACKUP_DIR must be absolute' >&2; exit 1; }
docker compose --env-file deploy/.env -f docker-compose.production.yml --profile ops run --rm --no-deps backup
# No sync/delete: a compromised or empty local directory must not erase recovery copies.
rclone copy "$BACKUP_DIR" "$BACKUP_REMOTE" --immutable --include '*.dump.age' --include '*.sha256'
echo 'Off-site encrypted backup copy completed.'

#!/bin/bash
set -euo pipefail
umask 077
: "${RESTORE_DATABASE:?Set a new restore_ database name}"
[[ "$RESTORE_DATABASE" =~ ^restore_[a-z0-9_]{1,40}$ ]] || { echo 'Use a new restore_ database name' >&2; exit 1; }
name=${1:?Pass the encrypted backup basename}
[[ "$name" =~ ^core-assist-[0-9TZ]+-[0-9]+\.dump\.age$ ]] || { echo 'Invalid backup basename' >&2; exit 1; }
export PGPASSWORD
PGPASSWORD=$(cat /run/secrets/postgres_password)
cd /backups
sha256sum -c "$name.sha256"
# Decrypt and inspect before creating a database. Never overwrite an existing DB.
temporary=$(mktemp /tmp/core-restore.XXXXXX)
trap 'rm -f -- "$temporary"' EXIT
age --decrypt --identity /run/secrets/backup_identity "$name" > "$temporary"
pg_restore --list "$temporary" > /dev/null
createdb "$RESTORE_DATABASE"
pg_restore --exit-on-error --no-owner --no-acl --dbname "$RESTORE_DATABASE" "$temporary"
printf 'Restored to isolated database: %s\n' "$RESTORE_DATABASE"

#!/bin/bash
set -euo pipefail
umask 077
: "${AGE_RECIPIENT:?Set the public age recipient}"
export PGPASSWORD
PGPASSWORD=$(cat /run/secrets/postgres_password)
name="core-assist-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}.dump.age"
temporary="/backups/${name}.partial"
trap 'rm -f -- "$temporary"' EXIT
pg_dump --format=custom --no-owner --no-acl | age --recipient "$AGE_RECIPIENT" > "$temporary"
test -s "$temporary"
mv -- "$temporary" "/backups/$name"
cd /backups
sha256sum "$name" > "$name.sha256"
printf 'Encrypted backup created: %s\n' "$name"

#!/bin/sh
set -eu
password=$(cat /run/secrets/redis_password)
# A generated hex password avoids Redis config escaping and shell interpolation.
case "$password" in ''|*[!a-fA-F0-9]*) echo 'Redis password must be hexadecimal' >&2; exit 1;; esac
[ "${#password}" -ge 64 ] || { echo 'Redis password too short' >&2; exit 1; }
umask 077
printf 'requirepass %s\n' "$password" > /tmp/redis-auth.conf
chown redis:redis /tmp/redis-auth.conf
exec /usr/local/bin/docker-entrypoint.sh redis-server /tmp/redis-auth.conf \
  --appendonly yes --appendfsync everysec --maxmemory 512mb --maxmemory-policy noeviction

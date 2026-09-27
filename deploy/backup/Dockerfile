FROM postgres:16-alpine
RUN apk add --no-cache age bash
COPY backup.sh /usr/local/bin/core-backup
COPY restore.sh /usr/local/bin/core-restore
ENTRYPOINT ["bash", "/usr/local/bin/core-backup"]

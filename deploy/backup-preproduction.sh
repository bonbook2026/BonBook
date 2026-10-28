#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/srv/bonbook-preproduction
snapshot=$(mktemp -d "$root/shared/backups/transfer.XXXXXX")
release_id=$(cat "$root/current/.release-sha")
trap 'rm -f "$snapshot/runtime.env" "$snapshot/bonbook.db" "$snapshot/source.tar.gz" "$snapshot/release-id"; rmdir "$snapshot"' EXIT
cp "$root/shared/runtime.env" "$snapshot/runtime.env"
cp "$root/incoming/$release_id.tar.gz" "$snapshot/source.tar.gz"
printf '%s\n' "$release_id" > "$snapshot/release-id"
python3 - "$root/shared/data/bonbook.db" "$snapshot/bonbook.db" <<'PY'
import sqlite3, sys
source = sqlite3.connect('file:' + sys.argv[1] + '?mode=ro', uri=True)
target = sqlite3.connect(sys.argv[2])
with target:
    source.backup(target)
assert target.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
target.close()
source.close()
PY
destination="$root/shared/backups/bonbook-transfer-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
if [[ -d "$root/shared/data/media" ]]; then
    tar -czf "$destination" -C "$snapshot" runtime.env bonbook.db source.tar.gz release-id -C "$root/shared/data" media
else
    tar -czf "$destination" -C "$snapshot" runtime.env bonbook.db source.tar.gz release-id
fi
chmod 0600 "$destination"
echo "$destination"

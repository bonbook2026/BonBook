#!/usr/bin/env bash
set -euo pipefail
umask 027

# This installer manages only BonBook. HTTPS proxy routing is installed separately.
release_id=${1:?Supply a commit SHA}
archive=${2:?Supply the source archive path}
environment=${3:?Supply the private environment-file path}
restore_database=${4:-}
restore_media=${5:-}
root=/srv/bonbook-preproduction
[[ "$release_id" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release id'; exit 1; }
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if (major<22 || (major===22 && minor<13)) process.exit(1)'
test -f "$archive"
test -f "$environment"
if ss -H -ltn sport = :3135 | grep -q . && ! systemctl is-active --quiet bonbook-preproduction.service; then
    echo 'Port 3135 belongs to another service; refusing to deploy.'
    exit 1
fi
if ! id bonbook >/dev/null 2>&1; then
    useradd --system --user-group --home-dir "$root" --shell /usr/sbin/nologin bonbook
fi
install -d -m 0750 -o root -g bonbook "$root" "$root/releases" "$root/shared" "$root/incoming"
install -d -m 0700 -o bonbook -g bonbook "$root/shared/data"
install -d -m 0700 -o bonbook -g bonbook "$root/shared/data/media"
install -d -m 0700 -o bonbook -g bonbook "$root/shared/npm-cache"
install -d -m 0700 -o root -g root "$root/shared/backups"
if [[ -e "$root/current" ]]; then
    tar -xOzf "$archive" deploy/backup-preproduction.sh > "$root/incoming/backup-preproduction.candidate.sh"
    chmod 0600 "$root/incoming/backup-preproduction.candidate.sh"
    bash "$root/incoming/backup-preproduction.candidate.sh" >/dev/null
fi
if [[ -n "$restore_database" ]]; then
    test ! -e "$root/shared/data/bonbook.db" || { echo 'Refusing to overwrite an existing database'; exit 1; }
    install -m 0600 -o bonbook -g bonbook "$restore_database" "$root/shared/data/bonbook.db"
fi
if [[ -n "$restore_media" ]]; then
    test -d "$restore_media"
    test -z "$(find "$root/shared/data/media" -mindepth 1 -print -quit)" || { echo 'Refusing to overwrite existing media'; exit 1; }
    cp -a "$restore_media/." "$root/shared/data/media/"
    chown -R bonbook:bonbook "$root/shared/data/media"
fi
release="$root/releases/$release_id"
test ! -e "$release" || { echo 'Release already exists; use another release id'; exit 1; }
install -d -m 0750 -o bonbook -g bonbook "$release"
tar -xzf "$archive" -C "$release" --no-same-owner
chown -R bonbook:bonbook "$release"
if ! command -v pdftoppm >/dev/null || ! command -v tesseract >/dev/null || [[ ! -s "$root/shared/data/ocr-models/fas.traineddata" ]]; then
    bash "$release/deploy/prepare-document-import.sh"
fi
install -m 0600 -o root -g root "$archive" "$root/incoming/$release_id.tar.gz"
if [[ ! -s "$root/shared/speech-models/.ready" ]]; then
    bash "$release/deploy/prepare-speech-alignment.sh"
fi
runuser -u bonbook -- env NPM_CONFIG_CACHE="$root/shared/npm-cache" NODE_ENV=development DATABASE_URL=file:./bonbook-build.db NODE_OPTIONS=--max-old-space-size=512 nice -n 10 bash -c '
    set -euo pipefail
    cd "$1"
    npm ci --prefix client --no-audit --no-fund
    npm ci --prefix server --no-audit --no-fund
    # Do not rely on dependency postinstall discovering a schema from the repository root.
    node server/node_modules/prisma/build/index.js generate --schema server/prisma/schema.prisma
    npm run test:demo --prefix client
    npm test --prefix server
    python3 -m unittest discover -s server/speech -p test_alignment.py
    NODE_ENV=production npm run build:preproduction
    # WAL lets reading, narration polling and admin imports share the SQLite file.
    python3 -c "import sqlite3; c=sqlite3.connect(\"/srv/bonbook-preproduction/shared/data/bonbook.db\",timeout=15); mode=c.execute(\"PRAGMA journal_mode=WAL\").fetchone()[0]; c.close(); assert mode.lower()==\"wal\""
    cd server
    DATABASE_URL=file:/srv/bonbook-preproduction/shared/data/bonbook.db ./node_modules/.bin/prisma migrate deploy
    DATABASE_URL=file:/srv/bonbook-preproduction/shared/data/bonbook.db node dist/seedLibrary.js
' _ "$release"
printf '%s\n' "$release_id" > "$release/.release-sha"
chown -R root:bonbook "$release"
chmod -R g+rX,o-rwx "$release"
if [[ -f "$root/shared/runtime.env" ]]; then
    install -m 0600 "$root/shared/runtime.env" "$root/incoming/runtime.previous.env"
fi
install -m 0640 -o root -g bonbook "$environment" "$root/shared/runtime.env"
install -m 0644 "$release/deploy/bonbook-preproduction.service" /etc/systemd/system/bonbook-preproduction.service
install -m 0644 "$release/deploy/bonbook-import-worker.service" /etc/systemd/system/bonbook-import-worker.service
install -m 0644 "$release/deploy/bonbook-speech-worker.service" /etc/systemd/system/bonbook-speech-worker.service
previous=$(readlink -f "$root/current" || true)
ln -s "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
systemctl daemon-reload
systemctl enable bonbook-preproduction.service
systemctl restart bonbook-preproduction.service
healthy=false
for attempt in $(seq 1 20); do
    if curl --fail --silent http://127.0.0.1:3135/api/health >/dev/null; then healthy=true; break; fi
    sleep 1
done
if [[ "$healthy" != true ]]; then
    if [[ -n "$previous" ]]; then
        if [[ -f "$root/incoming/runtime.previous.env" ]]; then
            install -m 0640 -o root -g bonbook "$root/incoming/runtime.previous.env" "$root/shared/runtime.env"
        fi
        ln -s "$previous" "$root/current.rollback"
        mv -Tf "$root/current.rollback" "$root/current"
        systemctl restart bonbook-preproduction.service
    else
        systemctl stop bonbook-preproduction.service
    fi
    echo 'BonBook did not become healthy; no proxy routing was activated.'
    exit 1
fi
echo "BonBook release $release_id is healthy on loopback port 3135."
systemctl enable bonbook-import-worker.service
systemctl restart bonbook-import-worker.service
systemctl enable bonbook-speech-worker.service
systemctl restart bonbook-speech-worker.service

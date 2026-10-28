# BonBook preproduction

This is an independent Node/Prisma application. It shares a machine and HTTPS
proxy with SignalVerse but has its own Unix user, systemd service, release folders,
JWT secret, Telegram token and SQLite database. No SignalVerse source, database,
bot credentials or service unit is used by BonBook.

- Public URL: https://bonbook.13-140-149-56.sslip.io/
- Private listener: `127.0.0.1:3135`
- Service: `bonbook-preproduction.service`, user/group `bonbook`
- Root: `/srv/bonbook-preproduction`
- Private environment: `shared/runtime.env` (root:bonbook, 0640)
- Database: `shared/data/bonbook.db` (bonbook, private directory)
- Code: `releases/<commit>/`, selected by `current`

## Prepare the private settings

Only `TELEGRAM_BOT_TOKEN` is copied from the ignored `.env.example.local` file.
Old example settings, GitHub credentials, USD prices and provider credentials are
not imported. A dedicated JWT secret is generated and kept on subsequent runs.

```powershell
npm run prepare:preproduction -- --public-url=https://bonbook.13-140-149-56.sslip.io/ --database-url=file:/srv/bonbook-preproduction/shared/data/bonbook.db
```

Transfer `server/.env.preproduction` over SSH to a private incoming directory. It
is never committed or included in the source archive. The server requires real
Telegram signed init data. The local Telegram simulator and real payments are
disabled. Orders can be recorded for testing without payment or email delivery.
The bot's Mini App/menu button must point to the public HTTPS URL.

## Install or update

Create a source archive of a reviewed commit using `git archive`. On a host with
Node 20+, npm, Python 3, systemd and an HTTPS proxy, transfer the source archive,
private environment file and this installer over SSH, then run as root:

```bash
bash install-preproduction.sh COMMIT_SHA /private/source.tar.gz /private/runtime.env
```

The installer creates only BonBook directories and service resources, tests and
builds the code, runs migrations against its own database, then selects the
release. It keeps the previous release and backs up the existing data before
updates. Run the following helper on a host whose existing Let's Encrypt account
is already configured. It creates only the dedicated BonBook vhost, obtains its
own certificate using HTTP-01, validates Nginx and gracefully reloads it:

```bash
python3 /srv/bonbook-preproduction/current/deploy/configure-free-domain.py bonbook.13-140-149-56.sslip.io
```

The helper also removes only BonBook's former location include from the shared
SignalVerse vhost, if present. No SignalVerse runtime restart is needed. The
preproduction client uses
relative assets and hash routing so its public path can move without rebuilding.

## Transfer to another server

On the source host, run as root:

```bash
bash /srv/bonbook-preproduction/current/deploy/backup-preproduction.sh
```

This creates a mode-0600 transfer archive in `shared/backups/` containing a consistent
SQLite backup, private environment, exact source archive and commit ID. Treat it
as a secret and transfer it only over SSH to the new host. Extract it in a private
directory. Set `FRONTEND_URL` in its `runtime.env` to the new HTTPS URL; keep the
database path and port, or adapt the unit/proxy together if those must change.
On the new, empty BonBook host:

```bash
bash install-preproduction.sh "$(cat release-id)" ./source.tar.gz ./runtime.env ./bonbook.db
```

The free sslip.io hostname embeds the server IP: choose a hostname containing the
new IP on transfer, then configure HTTPS with the helper above. Alternatively,
use a domain whose DNS you control to keep a permanent address. Configure its
HTTPS route, check health and Telegram login, then update the bot's
Mini App URL. The installer refuses to overwrite an existing database when restoring.
Keep the old installation until the new one is verified; stop only BonBook there
after cutover. Transfer archives are not published to GitHub or web directories.

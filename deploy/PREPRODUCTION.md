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

Only the named BonBook identity settings (`TELEGRAM_BOT_TOKEN`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `OWNER_TELEGRAM_USERNAME`, `OWNER_GOOGLE_EMAILS`) are copied
from the ignored `.env.example.local` file.
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
Node 22.13+, npm, Python 3, systemd and an HTTPS proxy, transfer the source archive,
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
root-relative assets and browser routing, including direct `/admin` access.
Host it at the root of its own HTTPS hostname. The GitHub Pages demo keeps hash routing.

## Transfer to another server

On the source host, run as root:

```bash
bash /srv/bonbook-preproduction/current/deploy/backup-preproduction.sh
```

This creates a mode-0600 transfer archive in `shared/backups/` containing a consistent
SQLite backup, uploaded `media/`, private environment, exact source archive and commit ID. Treat it
as a secret and transfer it only over SSH to the new host. Extract it in a private
directory. Set `FRONTEND_URL` in its `runtime.env` to the new HTTPS URL; keep the
database path and port, or adapt the unit/proxy together if those must change.
On the new, empty BonBook host:

```bash
bash install-preproduction.sh "$(cat release-id)" ./source.tar.gz ./runtime.env ./bonbook.db ./media
```

The free sslip.io hostname embeds the server IP: choose a hostname containing the
new IP on transfer, then configure HTTPS with the helper above. Alternatively,
use a domain whose DNS you control to keep a permanent address. Configure its
HTTPS route, check health and Telegram login, then update the bot's
Mini App URL. The installer refuses to overwrite an existing database when restoring.
Keep the old installation until the new one is verified; stop only BonBook there
after cutover. Transfer archives are not published to GitHub or web directories.

## Reader and administration

`BOOK_MEDIA_DIR=/srv/bonbook-preproduction/shared/data/media` keeps uploaded covers
and page audio with the database across releases. Backups snapshot SQLite before
copying immutable media; uploaded files are never physically removed by page edits.
The installer seeds original educational samples only when the library is empty.

Google login requires a Web application OAuth client, origin matching `FRONTEND_URL`,
and redirect URI `https://YOUR_HOST/api/auth/google/callback`. Only `openid email profile`
are requested. Add the intended accounts as Google test users while the consent screen
is in Testing. Update both the origin and redirect URI when moving to a new hostname.
Owner emails and Telegram username are private server settings, never frontend flags.
The first verified Telegram owner login pins its numeric ID in the database. Helper
admins claim invitations on a fresh verified login; revocation takes effect immediately.

`/library`, `/search` and `/read/BOOK/PAGE` show published content. Drafts and draft
media require admin authentication. `/admin` edits books and pages; `/admin/access`
is owner-only. Search ranks actual page text and editor keywords, and returns page
references. Audio uses an uploaded narration when available, otherwise the browser's
text-to-speech engine; Persian voice availability depends on the browser/device.

Full cover images stay in the original media asset. Set `coverLayout=SPREAD`, choose
the physical left/right front face and place `coverSpineStart`/`coverSpineEnd` on
the two spine edges (percent of image width). Both faces fit their entire crop
without trimming text; the reader can flip the cover from the library. Single
cover images continue to work. These settings travel with the database backup.

Only API requests count toward general rate limits. Anonymous clients retain
100 requests per 15 minutes; verified reader accounts have isolated 600-request
budgets. Current OWNER/ADMIN roles, checked in the database, are exempt from the
general API limit. Authentication and payment limits remain 20 and 10 respectively.
HTML, bundled assets and the health endpoint remain available after API exhaustion.

## Import books and scanned pages

The admin book editor accepts PDF, DOCX, EPUB, ODT, UTF-8/UTF-16 or Windows-1256
TXT/MD, and JPG/PNG/WebP/TIFF/BMP scans. One upload holds one document or up to
100 images, with a combined limit of 30 MiB. Image order can be changed before
upload. PDF page numbers are preserved; flowing document formats are divided
into reading pages and the preview labels that pagination difference.

`bonbook-import-worker.service` runs as the BonBook user with a separate 512 MiB
memory limit, 50% CPU quota, private temporary files and no Internet address
families. Only one job runs at a time. A restart resumes the last stored page;
repeated crashes stop after three attempts. The web service remains independent.
PDFs with scanned pages or a corrupt text layer can use Persian/English Tesseract
OCR. The installer prepares official Poppler/Tesseract packages and an official
Persian recognition model when missing. Model files live in `shared/data/ocr-models`
and can be downloaded again on a new host. Set `BONBOOK_TESSDATA_DIR`,
`BONBOOK_TESSERACT` or `BONBOOK_PDFTOPPM` for a custom local runtime if needed.

Extraction is staged for review. Admins can inspect/edit the extracted text, then
append the pages at an unused starting number. Existing text is never replaced.
Original documents and scans are immutable media assets included in transfer
backups; each imported reading page retains its source reference. Draft, hidden,
archived and trashed books, including their source files, require admin access.
OCR can make recognition errors, so review before publication.

Book deletion moves content to a recoverable trash state. Restore returns it as
hidden. Categories support parent/child groups; the admin list filters descendants
of a selected parent, searches titles/authors/tags, and paginates large collections.

For an authorized server-side example import, run `server/dist/queueBook.js` as
the BonBook user with `BONBOOK_ENV_FILE` pointing at its private runtime file.
Pass a private JSON file containing `file`, `filename`, `title`, `author`,
`category`, optional `parentCategory`, `tags` and optional `coverSha256`.
It creates a draft and stages an OCR job using an existing verified owner;
it never creates or exports authentication tokens.

## Chapter navigation

The book editor has a separate table of contents. Administrators can add rows,
paste `title | page` lines (Persian/Arabic digits work; prefix `>` for a subheading),
reorder entries, and adjust all destinations by a printed/file page offset.
Suggestions can be extracted from a selected range of up to 40 imported pages.
OCR suggestions are never saved automatically. Review titles and destinations
against the original PDF, then save. Every destination must exist in the book.
Deleting a reading page also removes its contents links. The reader offers both
chapter navigation and the full page list, and stops narration before a jump.

Uploaded narration supports administrator-authored line start times, stored with
exact text offsets on each reading page. In the audio editor, play the recording
and mark the beginning of each segment, then save the page. Text/audio changes
clear old timing cues in the editor; API updates that omit cues also invalidate
them if the source text or audio changes. The reader highlights the current line
and optionally scrolls it into view. Playback rate changes use media time.
Without saved cues, recorded audio uses an explicitly labelled approximate text
position. Browser narration uses utterance boundaries and spoken-word offsets.

## Bulk narration and offline speech alignment

Select a folder (including subfolders) or multiple audio files in the book editor.
The preview reads Persian/Arabic/Latin page numbers from filenames and allows
manual corrections and an offset. Ambiguous names, duplicate pages, missing
pages and existing narration are flagged before upload. Each file is uploaded
separately (30 MiB each, up to 2000 files per batch), so a large folder does not
need one enormous HTTP request. Reselect the same folder to resume an interrupted
batch; already attached items are idempotent. Replacement requires an explicit
option and a second check that the destination has not changed since planning.

The isolated `bonbook-speech-worker.service` consumes one recognition job at a
time, with a 3 GiB memory limit, one CPU quota, low priority and no Internet
address families. `prepare-speech-alignment.sh` installs a BonBook-only Python
venv and the pinned official Systran Whisper small conversion. AV is pinned to
16.1.0 for compatibility. Recognition uses local INT8 CPU inference and actual
word timestamps. A monotonic matcher handles Persian letter and spacing variants
against the existing book text; it does not replace that text with a transcript.
Only complete, high-coverage matches are applied automatically. Partial or weak
matches are retained for review, with possible alternative page numbers. Current
text/audio hashes and existing manual cues are checked again at application time.
Existing nonempty timing cues are preserved until an admin explicitly applies the
new suggestion. The book-wide recognition list supports including timed pages and
applying all confident suggestions together; stale snapshots are skipped.

Model/runtime files live under `shared/speech-venv` and `shared/speech-models`;
they can be rebuilt by the installer on a new host. Audio originals, batch state,
recognized word times and results are included in the ordinary media/SQLite
transfer backup. Override `BONBOOK_SPEECH_PYTHON` and `BONBOOK_SPEECH_MODEL` for
another compatible local runtime. Run the pure matching tests with
`python3 -m unittest discover -s server/speech -p test_alignment.py`.

## Illustrated reading pages

Each page can show text, an uploaded image, both, or automatic layout. Short PDF
pages automatically show the original page image; other pages offer an expandable
original image. Private/public source permissions are checked before rendering.
Poppler renders at most one uncached preview at a time; derived PNGs live in
`shared/data/page-previews`, may be regenerated and are excluded from transfer
backups. Uploaded page images are ordinary immutable media and are backed up.

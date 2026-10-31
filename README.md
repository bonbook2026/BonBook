# BonBook

### Prepared page text without repeating OCR

In the book editor, choose **فقط تصویر PDF یا عکس؛ بدون OCR** to import original page images and page numbers without reading their text. Add those pages, then use **متن آماده، بدون OCR دوباره** to attach prepared TXT/MD text.

- A full text file uses standalone markers such as `=== Page 11 ===` or `صفحه ۱۱`. A folder can contain `page-0011.txt`, `۱۱.txt`, etc. Persian and Arabic digits are supported; file order never determines the target page.
- The preview shows page matches, blank/missing/unchanged pages, and narration cue mapping. A page offset can account for a difference between file and book numbering. Duplicate numbers and unnumbered source text are rejected.
- Applying changes updates only page content, search text, and narration **character offsets**. Existing page IDs/order, headings, categories, contents, image/document references, audio files, cue timestamps, and reading progress stay intact. Low-similarity pages and uncertain cue mappings require review and are not selected automatically.
- The previous text and cues are retained in an admin-only revision. Undo restores them as a transaction, provided no later page or audio edits conflict. Both apply and undo reject a stale preview instead of overwriting newer work. Pending speech jobs for changed text are canceled; completed suggestions for older text cannot be applied to the new text.

The **فیلتر عبارت‌های متن** card stores up to 50 literal ignored phrases per book (one per line). The default is `<short pause>`. Prepared text, document imports and manual page saves remove those phrases before they reach the library. Existing content can be cleaned with a guarded preview and the same revision workflow. Character offsets are translated through the removed spans, preserving every audio timestamp. Old previews cannot reintroduce ignored phrases; restoring a revision containing one requires removing that phrase from the active filter first. The original uploaded files and recordings stay unchanged.

A Persian, right-to-left Telegram bookstore built with React, Vite, Express and Prisma (SQLite).

## Shareable preview

Open [the BonBook preview](https://bonbook2026.github.io/BonBook/) and choose **ورود آزمایشی تلگرام**.
The GitHub Pages demo runs entirely in the browser, with simulated Telegram login,
fixed Toman prices, profile editing, order history and simulated successful checkout.
No real payment, Telegram authentication, book delivery or email takes place. Each
browser has its own preview data. Use **شروع دوبارهٔ تست** to clear that data and start over.

The `Publish BonBook preview` workflow tests, builds and deploys the demo after a push
to `main`. The ordinary production build continues to use the real API and Telegram login.
To check the demo locally:

```powershell
npm run test:demo --prefix client
npm run build:demo --prefix client
npm run preview:demo --prefix client
```

Open http://127.0.0.1:4173/BonBook/.

## Run locally

For real Telegram login on an isolated server, see [the preproduction deployment
and transfer guide](deploy/PREPRODUCTION.md). The GitHub Pages preview remains a
browser-only demo; preproduction uses its own server, credentials and database.

Install Node.js 20 or newer, then run these commands from the project folder:

```powershell
npm install --prefix client
npm install --prefix server
Copy-Item .env.example server/.env
npm run db:generate
npm run db:migrate
npm run dev:local
```

Open http://127.0.0.1:5173/ and choose **ورود آزمایشی تلگرام** to use the local test account. See [LOCAL-TESTING.md](LOCAL-TESTING.md) for the simulator's behavior and restrictions.

The bookstore includes a dashboard, a book-title order form, an order summary, order history and a profile with an email address for delivery. The interface supports Persian and mobile screens.

## Configure integrations

Set real credentials in the ignored `server/.env` file. The Telegram bot, BonCard payment provider and SMTP delivery use their own settings from `.env.example`. Local test login simulates authentication; it does not simulate payment or email delivery.

Each book costs **1,500,000 Toman**, configured with `BOOK_PRICE_TOMAN`. Totals use
this fixed price and need no exchange-rate provider. The payment integration uses
IRR internally (10 IRR per Toman), while the interface displays Toman. Existing
orders retain their original totals. Apply database updates with `npx prisma migrate deploy`
from `server/`, then regenerate the Prisma client with `npx prisma generate`.

Do not commit real credentials or local databases. `.env.example` contains configuration examples only.

## Validation and builds

The admin workspace separates the catalog from site settings in a grouped menu.
Book editing has six task tabs, with page editing as the default and document
import first for a new empty book. Opened tasks stay mounted during tab changes
so selected files, unsaved inputs and active uploads are retained. Optional page
artwork, timing controls and destructive actions use explicit disclosures.
The library designer uses the same task navigation with a shared save action.
An eight-step book setup guide covers PDF import, cover setup, prepared text,
audio uploads, alignment, contents and publication. Its actions open the relevant
task without saving or publishing; guide position is remembered per book/device.
For each book, the guide derives its checklist from a fresh, administrator-only
snapshot of saved data. Saves and completed uploads refresh the counts immediately;
visible editors also refresh every fifteen seconds for background processing.
The next required task and missing page links follow actual text, attached audio,
valid saved timings and publication state. Ready speech suggestions need applying
before they count. Custom covers and contents are optional; explicitly image-only
pages do not require subtitles or a recording. Removing saved work reopens its task.
Guide navigation and device preferences never mark a task complete.

The reader can highlight matched physical lines on its original, watermarked page
image. PDF geometry is checked against saved text, with private Persian OCR as a
fallback. Matching current, applied speech word timestamps drive physical-line
timing; other recordings follow their saved text cues. Unmatched regions are not
guessed. An eye control zooms and follows the original book image in ordinary and
fullscreen reading, without changing transcript font size. It is remembered on
the device. Position maps are prepared in a bounded background queue and cached
privately; replacing source images, text or timings invalidates the map.

Fullscreen reading includes a sky journey driven by the real page order and the
current recording's playback percentage. The opening and closing two pages hold
their sky state. The site's selected day/night theme determines the starting
direction; the fullscreen control can invert it. The device remembers one of
three modes: cycling day/night, night-only (half moon to full moon), or day-only
(dawn to warm sunset). The sun/moon stays behind the book-edge pets. In night
mode the smaller white owl arrives before the gray owl, including a stagger after
a direct jump to the end. In day mode a cat walks in, sits, naps and responds to
petting. Butterflies, birds, fireflies and perched pets respond to touch. Ambient
motion can be paused and respects reduced-motion settings. The lunar texture is
an AI-generated transparent image at `client/public/images/moon-natural-v2.png`,
with its generation prompt beside it; spherical canvas lighting creates the soft
half-to-full phases. Dragging the sun/moon pauses audio and previews locally, then loads
and plays the selected position once on release. Recorded-page gaps advance to
the next recording at its beginning; if none remains, the chosen page opens
without invented audio. Canceling a drag resumes the prior playback state.

The isolated forty-second concept remains available through
`npm run preview:journey --prefix client`; it is a separate local Vite entry and
does not supply production pages or audio.

The reader paints authenticated, account-stamped page images onto canvas rather
than exposing an image/link hit target to mobile long-press menus. Context menus
and dragging are suppressed within the book; page taps and zoom still work.
Media requests retain session-bound grants, cookies and no-store caching. This
does not conceal requests from browser developer tools or block operating-system
screenshots, recording software or authorized extensions. Telegram Mini Apps do
not expose a documented API for setting the host app's screen-capture protection.

```powershell
npm test
npm run build:client
npm run build:server
```

## Project structure

- `client/`: React interface and the BonBook cover illustration.
- `server/`: API, authentication, integrations and tests.
- `server/prisma/`: database schema and migrations.
- `scripts/dev-local.mjs`: starts both local services.

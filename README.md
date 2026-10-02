# BonBook

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

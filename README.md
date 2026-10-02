# BonBook

A Persian, right-to-left Telegram bookstore built with React, Vite, Express and Prisma (SQLite).

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

Set real credentials in the ignored `server/.env` file. The Telegram bot, BonCard payment provider, exchange-rate provider and SMTP delivery use their own settings from `.env.example`. Local test login simulates authentication; it does not simulate payment, exchange rates or email delivery.

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

# Local Telegram login

From the BonBook project folder, run:

```powershell
npm run dev:local
```

Open <http://127.0.0.1:5173/> and click **ورود آزمایشی تلگرام**.
Both the frontend and API run locally; the API binds to `127.0.0.1` in this mode.
Stop any existing BonBook processes on ports 5173 and 3001 before using the combined command.

The simulator uses one reserved local account (`local:telegram:bonbook`) in the
configured database. Profile changes and orders persist across refreshes and
subsequent logins. The banner's logout button returns to the login screen.
The account starts with a name and surname; complete its email in the profile
to test the existing profile checks.

To run only the API with local login, use `npm run dev:server:local`, then run
`npm run dev:client` in another terminal. Regular `dev:server` does not enable
the simulator. The equivalent optional environment setting is
`ENABLE_LOCAL_TELEGRAM_LOGIN=true` with `NODE_ENV=development`.

Simulated login is rejected outside development, without the opt-in, for
non-loopback connections, and for non-local Host or Origin headers. Its marked
session tokens are also rejected when local mode is disabled or in production.
Real Telegram login still validates Telegram's signed init data normally.

This simulates login only. Exchange-rate, payment, and email integrations retain
their existing behavior and still need their own provider configuration for a
complete checkout test.

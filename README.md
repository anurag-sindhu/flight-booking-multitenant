# flight-booking-multitenant

Polls flight fare calendars on several booking sites every 5–10 minutes and sends an alert (via the tmrw notifications service) when a tracked flight hits a new low.

## Setup

Requires Node ≥ 20.12 and (optionally) Redis. Without Redis, price baselines live in memory and reset on restart.

```bash
npm install
cp .env.example .env   # fill in the values
npm start
```

## Configuration

- **`.env`**: secrets only: the tmrw notifications endpoint and its auth token, the Redis URL, and the session cookies or device IDs for each site.
- **`config.json`**: which platforms to poll, routes, departure dates, the price cap (`maxTrackedPrice`), Redis TTL, and `notificationChannels` (sent as `channel` to tmrw's `POST /notifications`). A route can be limited to some platforms with `platforms` or `excludePlatforms`.
- **`platforms/<name>/config.json`**: the request template for each site (URL, headers, query, body).

## Refreshing cookies

Cookies expire every few days or weeks. When a platform starts logging `unexpected response` errors, open the site in your browser, open DevTools → Network, copy the `cookie` request header from a fare request, and paste it into `.env` as `<PLATFORM>_COOKIE`. Then restart.

## Adding a platform

Create `platforms/<name>/index.js` that exports `fetchMapping(route)`, which returns `{ "YYYY-MM-DD": { amount, displayAmount, currencySymbol, airline?, url? } }`. Then add `<name>` to `platforms` in `config.json`.

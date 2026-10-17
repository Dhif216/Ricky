# Ricky Market

A fictional tech-accessories storefront built with Node.js, Express, vanilla JavaScript, CSS, and Tailwind CSS's browser CDN. It includes a shopping bag, product filters, consent-based visitor analytics, and a password-protected admin dashboard. Checkout is a demo and does not take payments.

The hero uses a headphone stock photo served from Unsplash; the image requires an internet connection.

## Requirements

- Node.js 20 or newer
- npm

## Run on Windows

1. Open this project folder in VS Code.
2. In the integrated terminal, install dependencies with `npm install`.
3. If you do not already have a local `.env`, copy `.env.example` to `.env` and set `ADMIN_PASSWORD` to a private password. Never commit `.env`.
4. Start the server with `npm run dev` (or `npm start`).
5. Visit `http://localhost:3000` for the storefront or `http://localhost:3000/admin` for the admin login.

The server creates `data/visits.json` when the first visitor accepts analytics. It can contain IP addresses, approximate locations, and browser-approved device coordinates; keep it private. `.env`, visitor data, and `node_modules` are excluded from Git. The dashboard at `/admin` is protected by `ADMIN_PASSWORD`, uses an HttpOnly/SameSite cookie, limits repeated failed logins, refreshes the event table every five seconds, and can clear stored records. If no password is configured, admin login is disabled.

## Privacy-minded demo analytics

The storefront first shows a blocking consent dialog with an expandable data explanation. Accepting enables IP-based analytics and triggers one browser location-permission request; closing declines analytics. If browser location permission is allowed, one device-location reading is sent with the visit. Device location may use GPS, Wi-Fi, or network signals, and accuracy varies. If permission is denied or unavailable, the other consented analytics still work. Coordinates are shown only in the password-protected dashboard. The app also records browser category, device category, screen dimensions, and time. The choice is kept in browser local storage; location is not requested again on later visits. The event API rejects requests without analytics consent. Up to 5,000 recent records are retained in the local JSON file; the authenticated dashboard has a delete-all action.

IP addresses and device coordinates are personal data. Use only with informed consent and an appropriate legal basis; explain purpose, recipients, and retention, restrict access, and delete records when no longer needed. Do not publish visitor data or credentials. The current password login is for local demonstration, not production security. Before public hosting, use a strong unique admin secret, HTTPS, secure hosting and storage, privacy/legal review, and an appropriate retention policy. Browser geolocation requires a secure context (HTTPS, or localhost during development). IP lookup is unavailable for localhost/private addresses, which display as local network.

## GitHub

The repository is prepared to keep `.env`, `data/`, and `node_modules/` out of Git. Commit `.env.example`, not your real `.env` or visitor records. GitHub Actions runs `npm ci` and `npm run check` on pushes and pull requests. Pushing source to GitHub does not run the Express server; deployment requires a Node.js host. Configure `ADMIN_PASSWORD` as a private environment variable on that host and use HTTPS for browser location permission. Do not deploy using the short local demo password: visitor analytics include IP addresses and potentially precise coordinates. Use a unique high-entropy production secret. Product photography is remotely hosted by Unsplash and Pexels and needs an internet connection. Add a license file only after choosing a license for your project.

### Deploy the full app with Render

This repository includes `render.yaml` for a Render Node web service. It sets `ADMIN_PASSWORD` as a dashboard-only secret prompt and mounts a persistent disk for visit records. The persistent disk requires a paid Render web-service plan; a free ephemeral service would lose JSON logs after restarts/deploys. Review Render's current prices before creating the service.

1. Sign in to Render and choose **New > Blueprint**.
2. Connect the `Dhif216/Ricky` GitHub repository and deploy the `main` branch.
3. When prompted for `ADMIN_PASSWORD`, enter a strong, unique password in Render itself. Do not put it in GitHub or this file. The password previously used for local testing was shared in chat, so change it before deploying publicly.
4. Accept the configured paid service and persistent disk, then wait for the health check to pass.
5. Share the Render service URL. The storefront is at `/`; the admin login is at `/admin`.

The Render service uses HTTPS, needed for browser location permission. Before inviting visitors, review the consent notice, data handling, and retention requirements. This school/demo starter is not production-hardened for collecting precise location or IP data.

## API

- `GET /api/health` — server health check.
- `POST /api/analytics/visit` — accepts an opted-in event and stores visit details in `data/visits.json`.
- `GET /admin` — admin login and dashboard page.
- `POST /api/admin/login`, `POST /api/admin/logout` — admin authentication.
- `GET /api/admin/visits`, `DELETE /api/admin/visits` — authenticated list and delete-all operations.

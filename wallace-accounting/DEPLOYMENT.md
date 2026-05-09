# Public Deployment Guide

This app is a full-stack Node.js service:

- React/Vite frontend
- Express + tRPC backend
- MySQL database via Drizzle
- OAuth login with an allowlist
- File storage proxy for statements, T4A PDFs, and receipt images

## Production Requirements

- Node.js 20 or newer
- pnpm 10.4.1
- MySQL database
- HTTPS domain
- OAuth app credentials
- Storage proxy credentials

## Required Environment Variables

Copy `.env.example` to `.env.production` on the server and fill in the values.

Important production values:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://user:password@host:3306/wallace_accounting
JWT_SECRET=replace-with-a-long-random-secret
OAUTH_SERVER_URL=https://your-oauth-server
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal
VITE_APP_ID=your-app-id
BUILT_IN_FORGE_API_URL=https://your-storage-proxy
BUILT_IN_FORGE_API_KEY=your-storage-api-key
```

Do not deploy with empty `JWT_SECRET`, `DATABASE_URL`, `OAUTH_SERVER_URL`, or storage credentials.

## Authentication

Production authentication uses OAuth and the allowlist in `server/_core/oauth.ts`.

To allow another user, add their email or username to `ALLOWED_IDENTIFIERS`:

```ts
const ALLOWED_IDENTIFIERS = new Set([
  "amy202601@gmail.com",
  "wallacefinancialservice@gmail.com",
  "new-user@example.com",
]);
```

The local development fallback user only works when:

- `NODE_ENV !== "production"`
- `OAUTH_SERVER_URL` is empty

It is intentionally disabled in production.

## Database

Run migrations before starting production traffic:

```bash
pnpm db:push
```

This command requires `DATABASE_URL`.

## Build And Start

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Build:

```bash
pnpm build
```

Start:

```bash
pnpm start
```

The app listens on `PORT`, defaulting to `3000`.

Health check endpoint:

```text
/healthz
```

## Docker

Build the image:

```bash
docker build -t wallace-accounting .
```

Run the container:

```bash
docker run -p 3000:3000 --env-file .env.production wallace-accounting
```

Use `/healthz` as the platform health check path.

## Reverse Proxy

Put the app behind HTTPS, for example with Nginx:

```nginx
server {
  server_name accounting.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

HTTPS is important because session cookies use secure settings when the request is HTTPS.

## Pre-Deploy Checklist

Run these locally or in CI:

```bash
pnpm check
pnpm test
pnpm build
```

Then smoke-test the production server:

```bash
NODE_ENV=production PORT=3000 node dist/index.js
```

Open:

```text
https://your-domain/
```

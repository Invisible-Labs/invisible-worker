# Invisible Worker

Cloudflare Worker example for server-side Invisible private transfers.

```bash
npm ci
npm run dev
```

Routes:

```txt
GET /health
GET /sdk
POST /private-transfer
```

Set secrets with Wrangler. Do not commit secrets.

When `@invisible/sdk` is available:

```bash
INVISIBLE_SDK_PACKAGE=latest npm run verify:sdk
npm run prepare:sdk
npm run deploy
```

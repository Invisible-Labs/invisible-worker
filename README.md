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

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

Required runtime config:

```txt
INVISIBLE_COORDINATOR_WS_URL=
INVISIBLE_RELEASE_MRTD=
INVISIBLE_INTEL_ROOT_FINGERPRINT=
INVISIBLE_WORKER_API_KEY=
```

The SDK requires DCAP collateral by default. For a legacy non-production coordinator that does not emit collateral yet, set `INVISIBLE_ALLOW_MISSING_DCAP_COLLATERAL=true`. The example rejects that flag in `prod` mode.

`POST /private-transfer` requires `Authorization: Bearer <INVISIBLE_WORKER_API_KEY>`.

When `@invisible/sdk` is available:

```bash
INVISIBLE_SDK_PACKAGE=latest npm run verify:sdk
npm run prepare:sdk
npm run deploy
```

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
POST /lp
```

Set secrets with Wrangler. Do not commit secrets.

Required runtime config:

```txt
INVISIBLE_COORDINATOR_WS_URL=
INVISIBLE_RELEASE_MRTD=
INVISIBLE_INTEL_ROOT_FINGERPRINT=
INVISIBLE_WORKER_API_KEY=
```

The SDK requires DCAP collateral by default. Production examples need a coordinator that emits `dcap_collateral` or a compatible attestation manifest. For legacy previews only, set `INVISIBLE_ALLOW_MISSING_DCAP_COLLATERAL=true`; this maps to `releasePin.allowMissingDcapCollateral` and is rejected in `prod` mode.

If the configured coordinator is still on an older wire contract, this preview can fail before a transfer is created. Once the matching coordinator and wire-contract rollout is live, the SDK package and coordinator will speak the same message names and payload shapes.

`POST /private-transfer` requires `Authorization: Bearer <INVISIBLE_WORKER_API_KEY>`.
`POST /lp` requires the same bearer token and accepts:

```json
{ "action": "create" }
```

For existing positions, pass `positionCode` with `recover`, `complete-dkg`,
`prepare-funding`, `reconcile-funding`, `refill`, or `withdraw`. `withdraw`
also requires `destinationAddress`.

When `@invisible/sdk` is available:

```bash
INVISIBLE_SDK_PACKAGE=npm:@invisible-labs/sdk@0.1.0-dev.1.2 npm run verify:sdk
npm run prepare:sdk
npm run deploy
```

`npm run verify:sdk` installs `@invisible/sdk@npm:@invisible-labs/sdk@0.1.0-dev.1.2` in a temporary consumer project when `INVISIBLE_SDK_PACKAGE` is unset. It allows freshly published private dev packages for that temporary install only, and must pass from the published or packaged SDK artifact, not from local monorepo paths or generated FROST files.

import worker from "../src/index.js";
import type { WorkerEnv } from "../src/sdk.js";

const env: WorkerEnv = {
  INVISIBLE_COORDINATOR_WS_URL: "wss://coordinator.example/ws-noise",
  INVISIBLE_REQUIRED_MODE: "dev",
  INVISIBLE_RELEASE_MRTD:
    "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  INVISIBLE_INTEL_ROOT_FINGERPRINT:
    "0000000000000000000000000000000000000000000000000000000000000000",
  DEMO_DESTINATION_ADDRESS: "11111111111111111111111111111111",
  INVISIBLE_WORKER_API_KEY: "test-key",
};

const health = await worker.fetch(new Request("https://worker.example/health"), env);
if (health.status !== 200) throw new Error("health route failed");

const transfer = await worker.fetch(
  new Request("https://worker.example/private-transfer", {
    method: "POST",
    headers: { authorization: "Bearer test-key" },
    body: JSON.stringify({ amountLamports: 1000 }),
  }),
  env,
);
if (transfer.status !== 503) throw new Error("private transfer should fail closed without SDK");

const lp = await worker.fetch(
  new Request("https://worker.example/lp", {
    method: "POST",
    headers: { authorization: "Bearer test-key" },
    body: JSON.stringify({ action: "recover", positionCode: "lp-code" }),
  }),
  env,
);
if (lp.status !== 503) throw new Error("LP route should fail closed without SDK");

const unauthorized = await worker.fetch(
  new Request("https://worker.example/private-transfer", {
    method: "POST",
    body: JSON.stringify({ amountLamports: 1000 }),
  }),
  env,
);
if (unauthorized.status !== 401) throw new Error("private transfer route must require auth");

const tooLarge = await worker.fetch(
  new Request("https://worker.example/private-transfer", {
    method: "POST",
    headers: { authorization: "Bearer test-key" },
    body: JSON.stringify({ amountLamports: 1000, memo: "x".repeat(5000) }),
  }),
  env,
);
if (tooLarge.status !== 413) throw new Error("private transfer route must enforce body limits");

console.log("worker simulation ok");

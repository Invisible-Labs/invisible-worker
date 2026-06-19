import worker from "../src/index.js";
import type { WorkerEnv } from "../src/sdk.js";

const env: WorkerEnv = {
  INVISIBLE_COORDINATOR_WS_URL: "wss://coordinator.example/ws-noise",
  INVISIBLE_REQUIRED_MODE: "dev",
  INVISIBLE_RELEASE_MRTD:
    "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  DEMO_DESTINATION_ADDRESS: "11111111111111111111111111111111",
};

const health = await worker.fetch(new Request("https://worker.example/health"), env);
if (health.status !== 200) throw new Error("health route failed");

const transfer = await worker.fetch(
  new Request("https://worker.example/private-transfer", {
    method: "POST",
    body: JSON.stringify({ amountLamports: 1000 }),
  }),
  env,
);
if (transfer.status !== 200) throw new Error("private transfer route failed");

console.log("worker simulation ok");

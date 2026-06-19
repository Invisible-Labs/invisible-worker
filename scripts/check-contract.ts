import { buildCoordinatorPool, type WorkerEnv } from "../src/sdk.js";

const env: WorkerEnv = {
  INVISIBLE_COORDINATOR_WS_URL: "wss://coordinator.example/ws-noise",
  INVISIBLE_REQUIRED_MODE: "dev",
  INVISIBLE_RELEASE_MRTD:
    "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  INVISIBLE_INTEL_ROOT_FINGERPRINT:
    "0000000000000000000000000000000000000000000000000000000000000000",
  DEMO_DESTINATION_ADDRESS: "11111111111111111111111111111111",
};

const pool = buildCoordinatorPool(env);
const pin = pool.endpoints[0]?.releasePin;
if (!pin?.mrtd || !pin.intelRootFingerprint) {
  throw new Error("coordinator release pin must include mrtd and intelRootFingerprint");
}

try {
  buildCoordinatorPool({ ...env, INVISIBLE_REQUIRED_MODE: "" });
  throw new Error("attestation mode must fail closed");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("INVISIBLE_REQUIRED_MODE")) {
    throw error;
  }
}

console.log("worker contract ok");

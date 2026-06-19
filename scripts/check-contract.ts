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
if ("allowMissingDcapCollateral" in pin) {
  throw new Error("missing DCAP collateral escape hatch must be disabled by default");
}

const legacyDevPin = buildCoordinatorPool({
  ...env,
  INVISIBLE_ALLOW_MISSING_DCAP_COLLATERAL: "true",
}).endpoints[0]?.releasePin;
if (legacyDevPin?.allowMissingDcapCollateral !== true) {
  throw new Error("non-prod legacy DCAP collateral escape hatch must be explicit");
}

try {
  buildCoordinatorPool({
    ...env,
    INVISIBLE_REQUIRED_MODE: "prod",
    INVISIBLE_ALLOW_MISSING_DCAP_COLLATERAL: "true",
  });
  throw new Error("prod mode must reject missing DCAP collateral escape hatch");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("DCAP")) {
    throw error;
  }
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

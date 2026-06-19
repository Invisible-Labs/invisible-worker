import { loadSdkBundle } from "./sdk-imports.generated.js";
import type { SdkRoot } from "./sdk-types.js";

export type WorkerEnv = {
  INVISIBLE_COORDINATOR_WS_URL: string;
  INVISIBLE_REQUIRED_MODE: "dev" | "prod" | "auto";
  INVISIBLE_RELEASE_MRTD: string;
  DEMO_DESTINATION_ADDRESS: string;
};

export type CoordinatorPoolConfig = {
  endpoints: Array<{
    wsUrl: string;
    expectedHostname: string;
    requiredMode: "dev" | "prod" | "auto";
    releasePin: { mrtd: string };
  }>;
  allowedRoles?: string[];
  preferLeader?: boolean;
};

export type PayoutPolicy = {
  destinations: Array<{
    address: string;
    sharePercent: number;
  }>;
};

export type AcceptanceReceipt = {
  accepted?: boolean;
  requestId?: string;
  request_id?: string;
};

export type PrivateTransferRequest = {
  amountLamports: number;
  destinationAddress?: string;
};

export async function sdkStatus(): Promise<{ packageAvailable: boolean }> {
  return { packageAvailable: (await loadSdk()) !== null };
}

export async function startPrivateTransfer(env: WorkerEnv, input: PrivateTransferRequest) {
  const sdk = await loadSdk();
  if (!sdk) {
    return {
      status: "sdk_missing",
      message: "Install @invisible/sdk from the private package registry before running this Worker.",
    };
  }

  try {
    const session = await sdk.root.createSession({
      coordinator: buildCoordinatorPool(env),
      storage: sdk.storage.inMemoryStorage?.(),
    });
    const receipt = await sdk.user.contractRequest(session, {
      amountLamports: assertLamports(input.amountLamports),
      payoutPolicy: singleDestinationPolicy(input.destinationAddress ?? env.DEMO_DESTINATION_ADDRESS),
      sync: true,
    });

    return {
      status: "accepted",
      requestId: receipt.requestId ?? receipt.request_id ?? "accepted",
    };
  } catch (error) {
    const message = normalizeSdkError(sdk.root, error);
    if (message.includes("NOT_ATTESTED") || message.includes("not attested")) {
      return {
        status: "sdk_not_ready",
        message: "SDK connected, but this package build has not completed coordinator attestation yet.",
      };
    }
    if (message.includes("NOT_IMPLEMENTED") || message.includes("not implemented")) {
      return {
        status: "sdk_not_ready",
        message: "SDK package is installed, but this command is still preview-only in the current build.",
      };
    }
    return { status: "failed", message };
  }
}

export function buildCoordinatorPool(env: WorkerEnv): CoordinatorPoolConfig {
  const endpoint = new URL(env.INVISIBLE_COORDINATOR_WS_URL);
  if (endpoint.protocol !== "wss:" && endpoint.protocol !== "ws:") {
    throw new Error("INVISIBLE_COORDINATOR_WS_URL must use ws:// or wss://");
  }

  return {
    endpoints: [
      {
        wsUrl: env.INVISIBLE_COORDINATOR_WS_URL,
        expectedHostname: endpoint.hostname,
        requiredMode: env.INVISIBLE_REQUIRED_MODE,
        releasePin: { mrtd: env.INVISIBLE_RELEASE_MRTD },
      },
    ],
    allowedRoles: ["leader"],
    preferLeader: true,
  };
}

function singleDestinationPolicy(destinationAddress: string): PayoutPolicy {
  return {
    destinations: [{ address: destinationAddress.trim(), sharePercent: 100 }],
  };
}

function assertLamports(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("amountLamports must be a positive safe integer.");
  }
  return value;
}

async function loadSdk() {
  return loadSdkBundle();
}

function normalizeSdkError(sdk: SdkRoot, error: unknown): string {
  if (sdk.normalizeError) return sdk.normalizeError(error, "Invisible transfer failed.");
  if (error instanceof Error) return error.message;
  return "Invisible transfer failed.";
}

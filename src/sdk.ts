import { loadSdkBundle } from "./sdk-imports.generated.js";
import type { SdkBundle, SdkLpPosition, SdkRoot } from "./sdk-types.js";

export type WorkerEnv = {
  INVISIBLE_COORDINATOR_WS_URL: string;
  INVISIBLE_REQUIRED_MODE: string;
  INVISIBLE_RELEASE_MRTD: string;
  INVISIBLE_INTEL_ROOT_FINGERPRINT: string;
  INVISIBLE_ALLOW_MISSING_DCAP_COLLATERAL?: string;
  DEMO_DESTINATION_ADDRESS: string;
  INVISIBLE_WORKER_API_KEY?: string;
};

export type CoordinatorPoolConfig = {
  endpoints: Array<{
    wsUrl: string;
    expectedHostname: string;
    requiredMode: "dev" | "prod" | "auto";
    releasePin: {
      mrtd: string;
      intelRootFingerprint: string;
      allowMissingDcapCollateral?: boolean;
    };
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

export type LpAction =
  | "create"
  | "recover"
  | "complete-dkg"
  | "prepare-funding"
  | "reconcile-funding"
  | "refill"
  | "withdraw";

export type LpActionRequest = {
  action: LpAction;
  positionCode?: string;
  destinationAddress?: string;
};

export type LpActionResult =
  | {
      status: "position";
      action: LpAction;
      message: string;
      position: LpPositionSummary;
      lpPositionCode?: string;
    }
  | {
      status: "funding";
      action: "prepare-funding";
      message: string;
      position: LpPositionSummary;
      address: string;
      requiredLamports: number;
      qrPayload: string;
    }
  | {
      status: "withdrawal";
      action: "withdraw";
      message: string;
      position: LpPositionSummary;
      withdrawalId: string;
      txSignatures: string[];
    }
  | { status: "sdk_missing"; message: string }
  | { status: "sdk_not_ready"; message: string }
  | { status: "failed"; message: string };

export type LpPositionSummary = {
  id: string;
  status: string;
  targetShardCount: number;
  shardCount: number;
  availableShardCount: number;
  fundingQueuedShardCount: number;
  pregeneratedShardCount: number;
  committedLamports: number;
  earnedLamports: number;
};

const LP_DEFAULT_TARGET_SHARDS = 200;
const LP_INITIAL_FUNDING_LAMPORTS = 101_000_000;
const LP_WITHDRAWAL_ALLOW_MANY_TO_ONE = true;

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
    try {
      const receipt = await sdk.user.contractRequest(session, {
        amountLamports: assertLamports(input.amountLamports),
        payoutPolicy: singleDestinationPolicy(input.destinationAddress ?? env.DEMO_DESTINATION_ADDRESS),
        sync: true,
      });

      return {
        status: "accepted",
        requestId: receipt.requestId ?? receipt.request_id ?? "accepted",
      };
    } finally {
      sdk.root.closeSession?.(session);
    }
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

export async function runLpAction(env: WorkerEnv, input: LpActionRequest): Promise<LpActionResult> {
  const sdk = await loadSdk();
  if (!sdk) {
    return {
      status: "sdk_missing",
      message: "Install @invisible/sdk from the private package registry before running LP actions.",
    };
  }

  try {
    const session = await sdk.root.createSession({
      coordinator: buildCoordinatorPool(env),
      storage: sdk.storage.inMemoryStorage?.(),
    });

    try {
      if (input.action === "create") {
        const result = await sdk.lp.createPosition(session, {
          committedLamports: LP_INITIAL_FUNDING_LAMPORTS,
          shardCount: LP_DEFAULT_TARGET_SHARDS,
        });
        const position =
          result.position ?? (await sdk.lp.recoverPosition(session, { code: result.lpPositionCode }));
        return {
          status: "position",
          action: input.action,
          message: "LP position created. Store the LP Position Code before continuing.",
          position: summarizeLpPosition(position),
          lpPositionCode: result.lpPositionCode,
        };
      }

      const recovered = await recoverLpPositionForAction(sdk, session, input.positionCode);
      if (input.action === "recover") {
        return {
          status: "position",
          action: input.action,
          message: "LP position recovered.",
          position: summarizeLpPosition(recovered),
        };
      }

      if (input.action === "complete-dkg") {
        const position = await sdk.lp.completeDkgBatch(session, recovered.id);
        return {
          status: "position",
          action: input.action,
          message: "LP DKG batch completed or reconciled.",
          position: summarizeLpPosition(position),
        };
      }

      if (input.action === "prepare-funding") {
        const plan = await sdk.lp.prepareInitialFunding(session, recovered.id);
        if (plan === null) {
          return {
            status: "position",
            action: input.action,
            message: "No LP_DKG_0 funding action is currently available.",
            position: summarizeLpPosition(recovered),
          };
        }
        return {
          status: "funding",
          action: input.action,
          message: "Fund only LP_DKG_0 with the exact required amount.",
          position: summarizeLpPosition(plan.position ?? recovered),
          address: plan.address,
          requiredLamports: plan.requiredLamports,
          qrPayload: plan.qrPayload,
        };
      }

      if (input.action === "reconcile-funding") {
        const position = await sdk.lp.reconcileFunding(session, recovered.id);
        return {
          status: "position",
          action: input.action,
          message: "LP funding reconciled from coordinator state.",
          position: summarizeLpPosition(position),
        };
      }

      if (input.action === "refill") {
        const position = await sdk.lp.refill(session, recovered.id);
        return {
          status: "position",
          action: input.action,
          message: "LP refill requested through the SDK lifecycle.",
          position: summarizeLpPosition(position),
        };
      }

      const destination = input.destinationAddress?.trim();
      if (!destination) throw new Error("destinationAddress is required for withdraw.");
      const result = await sdk.lp.withdrawPosition(session, recovered.id, {
        destinationAddresses: [destination],
        allowManyToOne: LP_WITHDRAWAL_ALLOW_MANY_TO_ONE,
      });
      return {
        status: "withdrawal",
        action: input.action,
        message: "LP withdrawal requested. Reconciliation stays SDK-owned.",
        position: summarizeLpPosition(result.position),
        withdrawalId: result.execution.withdrawalId,
        txSignatures: result.execution.txSignatures,
      };
    } finally {
      sdk.root.closeSession?.(session);
    }
  } catch (error) {
    const message = normalizeSdkError(sdk.root, error);
    if (message.includes("NOT_ATTESTED") || message.includes("not attested")) {
      return {
        status: "sdk_not_ready",
        message: "SDK connected, but this package build has not completed coordinator attestation yet.",
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
  const requiredMode = readRequiredMode(env.INVISIBLE_REQUIRED_MODE);
  const allowMissingDcapCollateral = readBoolean(
    env.INVISIBLE_ALLOW_MISSING_DCAP_COLLATERAL,
    false,
  );
  if (requiredMode === "prod" && allowMissingDcapCollateral) {
    throw new Error("INVISIBLE_ALLOW_MISSING_DCAP_COLLATERAL is only allowed outside prod mode");
  }

  return {
    endpoints: [
      {
        wsUrl: env.INVISIBLE_COORDINATOR_WS_URL,
        expectedHostname: endpoint.hostname,
        requiredMode,
        releasePin: {
          mrtd: env.INVISIBLE_RELEASE_MRTD,
          intelRootFingerprint: env.INVISIBLE_INTEL_ROOT_FINGERPRINT,
          ...(allowMissingDcapCollateral ? { allowMissingDcapCollateral: true } : {}),
        },
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

function readRequiredMode(value: string): "dev" | "prod" | "auto" {
  if (value === "dev" || value === "prod" || value === "auto") return value;
  throw new Error("INVISIBLE_REQUIRED_MODE must be dev, prod, or auto");
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

async function loadSdk() {
  return loadSdkBundle();
}

async function recoverLpPositionForAction(
  sdk: SdkBundle,
  session: Awaited<ReturnType<SdkRoot["createSession"]>>,
  positionCode: string | undefined,
): Promise<SdkLpPosition> {
  const code = positionCode?.trim();
  if (!code) throw new Error("positionCode is required for this LP action.");
  return sdk.lp.recoverPosition(session, { code });
}

function summarizeLpPosition(position: SdkLpPosition): LpPositionSummary {
  return {
    id: position.id,
    status: position.status,
    targetShardCount: position.targetShardCount,
    shardCount: position.shards.length,
    availableShardCount: countLpShards(position, "AVAILABLE"),
    fundingQueuedShardCount: countLpShards(position, "FUNDING_QUEUED"),
    pregeneratedShardCount: countLpShards(position, "PREGENERATED"),
    committedLamports: position.committedLamports,
    earnedLamports: position.earnedLamports,
  };
}

function countLpShards(position: SdkLpPosition, status: string): number {
  return position.shards.filter((shard) => shard.status === status).length;
}

function normalizeSdkError(sdk: SdkRoot, error: unknown): string {
  if (sdk.normalizeError) return sdk.normalizeError(error, "Invisible transfer failed.");
  if (error instanceof Error) return error.message;
  return "Invisible transfer failed.";
}

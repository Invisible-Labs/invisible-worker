export type SdkSession = { readonly attested?: boolean };

export type SdkRoot = {
  createSession(options: { coordinator: unknown; storage?: unknown }): Promise<SdkSession>;
  closeSession?(session: SdkSession): void;
  normalizeError?(error: unknown, fallback?: string): string;
};

export type SdkUser = {
  contractRequest(
    session: SdkSession,
    args: {
      amountLamports: number;
      payoutPolicy: unknown;
      sync?: boolean;
    },
  ): Promise<{
    accepted?: boolean;
    requestId?: string;
    request_id?: string;
  }>;
};

export type SdkStorage = {
  inMemoryStorage?(): unknown;
};

export type SdkLpPosition = {
  id: string;
  status: string;
  targetShardCount: number;
  shards: Array<{ status: string }>;
  committedLamports: number;
  earnedLamports: number;
};

export type SdkLp = {
  createPosition(
    session: SdkSession,
    args?: { committedLamports?: number; shardCount?: number },
  ): Promise<{ positionId: string; lpPositionCode: string; position?: SdkLpPosition }>;
  recoverPosition(session: SdkSession, args: { code: string }): Promise<SdkLpPosition>;
  completeDkgBatch(session: SdkSession, positionId: string): Promise<SdkLpPosition>;
  prepareInitialFunding(
    session: SdkSession,
    positionId: string,
  ): Promise<{
    address: string;
    requiredLamports: number;
    qrPayload: string;
    position?: SdkLpPosition;
  } | null>;
  reconcileFunding(session: SdkSession, positionId: string): Promise<SdkLpPosition>;
  refill(session: SdkSession, positionId: string): Promise<SdkLpPosition>;
  withdrawPosition(
    session: SdkSession,
    positionId: string,
    args: { destinationAddresses: string[]; allowManyToOne: boolean },
  ): Promise<{
    execution: { withdrawalId: string; txSignatures: string[] };
    position: SdkLpPosition;
  }>;
};

export type SdkBundle = {
  root: SdkRoot;
  user: SdkUser;
  storage: SdkStorage;
  lp: SdkLp;
};

export type SdkSession = { readonly attested?: boolean };

export type SdkRoot = {
  createSession(options: { coordinator: unknown; storage?: unknown }): Promise<SdkSession>;
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

export type SdkBundle = {
  root: SdkRoot;
  user: SdkUser;
  storage: SdkStorage;
};

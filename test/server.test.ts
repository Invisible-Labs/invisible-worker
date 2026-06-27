import { describe, expect, it, vi } from "vitest";

vi.mock("../src/sdk-basics.js", () => ({
  createLpPositionFlow: vi.fn(),
  openAttestedSession: vi.fn(),
  requestPrivateRefund: vi.fn(),
  runLocalSdkUtilityCheck: vi.fn(async () => ({
    storageKind: "memory",
    recoveryCodeHexLength: 64,
    refundableLamports: 1_995_000,
  })),
  runPrivateTransfer: vi.fn(),
  sdkErrorCode: vi.fn(() => "TEST_ERROR"),
  sdkSurfaceCoverage: {
    session: { createSession: vi.fn() },
    user: { createCoordinatorSession: vi.fn() },
    lp: { createLpLifecycleClient: vi.fn() },
    stats: { derivedRefundableLamports: vi.fn() },
    events: { subscribeEvents: vi.fn() },
  },
}));

vi.mock("../src/config.js", () => ({
  loadCoordinatorPool: vi.fn(() => ({ endpoints: [] })),
  mutationsEnabled: vi.fn(() => false),
  serverPort: vi.fn(() => 8787),
}));

describe("Node server routes", () => {
  it("returns local SDK utility health", async () => {
    const { route } = await import("../src/server.js");
    const response = await route("GET", "/health");
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("fails closed for mutating routes by default", async () => {
    const { route } = await import("../src/server.js");
    const response = await route("POST", "/transfers", {});
    expect(response.status).toBe(403);
  });
});

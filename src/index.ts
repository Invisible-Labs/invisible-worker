import { HttpError, json, readJsonBody } from "./http.js";
import { sdkStatus, startPrivateTransfer, type PrivateTransferRequest, type WorkerEnv } from "./sdk.js";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/sdk") {
        return json(await sdkStatus());
      }

      if (request.method === "POST" && url.pathname === "/private-transfer") {
        await requireBearerToken(request, env);
        const input = await readJsonBody<PrivateTransferRequest>(request);
        const result = await startPrivateTransfer(env, input);
        return json(result, { status: statusForTransfer(result.status) });
      }

      return json({ error: "not_found" }, { status: 404 });
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, { status: error.status });
      }
      return json(
        { error: error instanceof Error ? error.message : "request failed" },
        { status: 400 },
      );
    }
  },
};

async function requireBearerToken(request: Request, env: WorkerEnv): Promise<void> {
  const expected = env.INVISIBLE_WORKER_API_KEY?.trim();
  if (!expected) throw new HttpError(503, "Worker API key is not configured.");

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!provided || !(await timingSafeEqual(provided, expected))) {
    throw new HttpError(401, "Unauthorized.");
  }
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let i = 0; i < Math.max(leftBytes.length, rightBytes.length); i += 1) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }
  return diff === 0;
}

function statusForTransfer(status: string): number {
  switch (status) {
    case "accepted":
      return 202;
    case "sdk_missing":
      return 503;
    case "sdk_not_ready":
      return 501;
    case "failed":
      return 502;
    default:
      return 500;
  }
}

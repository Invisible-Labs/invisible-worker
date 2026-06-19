import { json, readJsonBody } from "./http.js";
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
        const input = await readJsonBody<PrivateTransferRequest>(request);
        return json(await startPrivateTransfer(env, input));
      }

      return json({ error: "not_found" }, { status: 404 });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "request failed" },
        { status: 400 },
      );
    }
  },
};

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { PayoutSpec } from "@invisible-labs/sdk/user";
import { loadCoordinatorPool, mutationsEnabled, serverPort } from "./config.js";
import {
  createLpPositionFlow,
  openAttestedSession,
  requestPrivateRefund,
  runLocalSdkUtilityCheck,
  runPrivateTransfer,
  sdkErrorCode,
  sdkSurfaceCoverage,
} from "./sdk-basics.js";

const CONTENT_TYPE_HEADER = "content-type";
const JSON_CONTENT_TYPE = "application/json";
const MUTATION_DISABLED_MESSAGE =
  "Live SDK mutations are disabled. Set INVISIBLE_ENABLE_MUTATIONS=true.";

type JsonBody = Record<string, unknown>;

export async function route(method: string, pathname: string, body: JsonBody = {}): Promise<Response> {
  const coordinatorPool = loadCoordinatorPool();

  if (method === "GET" && pathname === "/health") {
    return json({ ok: true, sdk: await runLocalSdkUtilityCheck() });
  }

  if (method === "GET" && pathname === "/sdk/surface") {
    return json({
      areas: Object.fromEntries(
        Object.entries(sdkSurfaceCoverage).map(([area, functions]) => [area, Object.keys(functions)]),
      ),
    });
  }

  if (method === "POST" && pathname === "/attestation") {
    const handle = await openAttestedSession(coordinatorPool);
    handle.close();
    return json({ ok: true });
  }

  if (!mutationsEnabled()) {
    return json({ error: MUTATION_DISABLED_MESSAGE }, 403);
  }

  if (method === "POST" && pathname === "/transfers") {
    const payoutSpec = body.payoutSpec as PayoutSpec | undefined;
    const amountLamports = Number(body.amountLamports);
    if (!Number.isSafeInteger(amountLamports) || payoutSpec === undefined) {
      return json({ error: "amountLamports and payoutSpec are required" }, 400);
    }
    return json(await runPrivateTransfer(coordinatorPool, { amountLamports, payoutSpec }));
  }

  if (method === "POST" && pathname === "/refunds") {
    const swapId = stringBody(body, "swapId");
    const recoveryCode = stringBody(body, "recoveryCode");
    if (swapId === undefined || recoveryCode === undefined) {
      return json({ error: "swapId and recoveryCode are required" }, 400);
    }
    return json(
      await requestPrivateRefund(coordinatorPool, {
        swapId,
        recoveryCode,
        syncSecretHex: stringBody(body, "syncSecretHex"),
      }),
    );
  }

  if (method === "POST" && pathname === "/lp/positions") {
    const handle = await openAttestedSession(coordinatorPool);
    try {
      return json(await createLpPositionFlow(handle.session));
    } finally {
      handle.close();
    }
  }

  return json({ error: "not found" }, 404);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE },
  });
}

function stringBody(body: JsonBody, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function readBody(request: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonBody;
}

function writeResponse(target: ServerResponse, response: Response): void {
  target.statusCode = response.status;
  response.headers.forEach((value, key) => target.setHeader(key, value));
  void response.text().then((body) => target.end(body));
}

export function startServer(port = serverPort()): void {
  createServer((request, response) => {
    void handleNodeRequest(request, response);
  }).listen(port, () => {
    console.log(`Invisible SDK Node server listening on ${port}`);
  });
}

async function handleNodeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const routed = await route(request.method ?? "GET", url.pathname, await readBody(request));
    writeResponse(response, routed);
  } catch (error) {
    writeResponse(response, json({ error: sdkErrorCode(error) }, 500));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

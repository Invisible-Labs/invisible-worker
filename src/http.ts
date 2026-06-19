export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });
}

export async function readJsonBody<T>(request: Request, maxBytes = 4096): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error("Request body is too large.");
  }

  const body = await request.text();
  if (body.length > maxBytes) throw new Error("Request body is too large.");
  return JSON.parse(body) as T;
}

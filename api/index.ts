import { app } from "../backend/src/app";

// Vercel invokes this Express application per request. The long-lived HTTP
// server and WebSocket upgrade handling remain exclusively for local/Railway
// development and are intentionally not started here.
export default function handler(
  request: Parameters<typeof app>[0],
  response: Parameters<typeof app>[1]
) {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const path = requestUrl.searchParams.get("path");

  if (path) {
    requestUrl.searchParams.delete("path");
    const normalizedPath = path.replace(/^\/+/, "");
    const isHealthCheck = normalizedPath === "health" || normalizedPath.startsWith("health/");
    const query = requestUrl.searchParams.toString();

    request.url = `${isHealthCheck ? "" : "/api"}/${normalizedPath}${query ? `?${query}` : ""}`;

    // Vercel materializes rewrite query parameters on the request object before
    // Express parses the rewritten URL. Remove this internal routing value so
    // strict Zod schemas only receive the application's actual query values.
    delete (request.query as Record<string, unknown>).path;
  }

  return app(request, response);
}

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
  }

  return app(request, response);
}

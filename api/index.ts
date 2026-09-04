import { app } from "../backend/src/app";

// Vercel invokes this Express application per request. The long-lived HTTP
// server and WebSocket upgrade handling remain exclusively for local/Railway
// development and are intentionally not started here.
export default app;

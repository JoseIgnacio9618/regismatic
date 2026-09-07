import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Fluid Compute can handle concurrent requests in one instance. A small pool
// avoids serializing them behind the migration's connection_limit=1.
const connectionLimit = env.DATABASE_CONNECTION_LIMIT ?? (process.env.VERCEL === "1" ? 3 : undefined);
const datasourceUrl = new URL(env.DATABASE_URL);
if (connectionLimit !== undefined) {
  datasourceUrl.searchParams.set("connection_limit", String(connectionLimit));
}

// Reuse one client (and pool) for the lifetime of the function instance.
export const prisma = new PrismaClient({ datasourceUrl: datasourceUrl.toString() });

import { Router } from "express";
import { prisma } from "../config/prisma";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ready" });
  } catch {
    return res.status(503).json({ status: "not_ready" });
  }
});

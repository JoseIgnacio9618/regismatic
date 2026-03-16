import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { authRouter } from "./routes/auth.routes";
import { attendanceRouter } from "./routes/attendance.routes";
import { notificationRouter } from "./routes/notification.routes";
import { reportRouter } from "./routes/report.routes";
import { userRouter } from "./routes/user.routes";
import { AppError, errorMiddleware } from "./middlewares/error.middleware";

export const app = express();

if (env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." }
});

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ready" });
  } catch {
    return res.status(503).json({ status: "not_ready" });
  }
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register-admin", authLimiter);
app.use("/api/auth", authRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/reports", reportRouter);
app.use("/api/users", userRouter);

app.use((_req, _res, next) => {
  next(new AppError("Route not found.", 404));
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error.",
      details: err.issues
    });
  }

  return errorMiddleware(err, req, res, next);
});

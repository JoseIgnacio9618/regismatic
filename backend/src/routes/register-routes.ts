import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { authRouter } from "./auth.routes";
import { attendanceRouter } from "./attendance.routes";
import { billingRouter } from "./billing.routes";
import { notificationRouter } from "./notification.routes";
import { reportRouter } from "./report.routes";
import { userRouter } from "./user.routes";

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." }
});

const authRateLimitedPaths = ["/login", "/register-admin", "/register-employee"] as const;

const apiRoutes = [
  ["/api/auth", authRouter],
  ["/api/attendance", attendanceRouter],
  ["/api/billing", billingRouter],
  ["/api/notifications", notificationRouter],
  ["/api/reports", reportRouter],
  ["/api/users", userRouter]
] as const;

export function registerRoutes(app: Express) {
  authRateLimitedPaths.forEach((path) => {
    app.use(`/api/auth${path}`, authLimiter);
  });

  apiRoutes.forEach(([path, router]) => {
    app.use(path, router);
  });
}

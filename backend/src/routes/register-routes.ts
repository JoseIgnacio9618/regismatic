import type { Express } from "express";
import { authRouter } from "./auth.routes";
import { attendanceRouter } from "./attendance.routes";
import { billingRouter } from "./billing.routes";
import { notificationRouter } from "./notification.routes";
import { reportRouter } from "./report.routes";
import { userRouter } from "./user.routes";

const apiRoutes = [
  ["/api/auth", authRouter],
  ["/api/attendance", attendanceRouter],
  ["/api/billing", billingRouter],
  ["/api/notifications", notificationRouter],
  ["/api/reports", reportRouter],
  ["/api/users", userRouter]
] as const;

export function registerRoutes(app: Express) {
  apiRoutes.forEach(([path, router]) => {
    app.use(path, router);
  });
}

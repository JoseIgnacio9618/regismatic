import { Router } from "express";
import {
  breakEndController,
  breakStartController,
  clockInController,
  clockOutController,
  manualAdjustmentController,
  todayStatusController
} from "../controllers/attendance.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/async-handler";

export const attendanceRouter = Router();

attendanceRouter.use(authMiddleware);
attendanceRouter.get("/today", asyncHandler(todayStatusController));
attendanceRouter.post("/clock-in", asyncHandler(clockInController));
attendanceRouter.post("/break-start", asyncHandler(breakStartController));
attendanceRouter.post("/break-end", asyncHandler(breakEndController));
attendanceRouter.post("/clock-out", asyncHandler(clockOutController));
attendanceRouter.post("/manual-adjustment", requireRole(["ADMIN"]), asyncHandler(manualAdjustmentController));

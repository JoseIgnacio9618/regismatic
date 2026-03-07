import { Router } from "express";
import {
  breakEndController,
  breakStartController,
  clockInController,
  clockOutController,
  createEditRequestController,
  listEditRequestsController,
  listEventsController,
  manualAdjustmentController,
  reviewEditRequestController,
  todayStatusController,
  updateEventController
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
attendanceRouter.get("/events", asyncHandler(listEventsController));
attendanceRouter.patch("/events/:eventId", requireRole(["ADMIN"]), asyncHandler(updateEventController));
attendanceRouter.post("/events/:eventId/edit-requests", asyncHandler(createEditRequestController));
attendanceRouter.get("/edit-requests", asyncHandler(listEditRequestsController));
attendanceRouter.patch(
  "/edit-requests/:requestId/review",
  requireRole(["ADMIN"]),
  asyncHandler(reviewEditRequestController)
);

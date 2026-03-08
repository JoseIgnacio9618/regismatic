import { Router } from "express";
import {
  listNotificationsController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
  registerPushTokenController
} from "../controllers/notification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const notificationRouter = Router();

notificationRouter.use(authMiddleware);
notificationRouter.get("/", asyncHandler(listNotificationsController));
notificationRouter.patch("/read-all", asyncHandler(markAllNotificationsAsReadController));
notificationRouter.patch("/:notificationId/read", asyncHandler(markNotificationAsReadController));
notificationRouter.post("/push-token", asyncHandler(registerPushTokenController));

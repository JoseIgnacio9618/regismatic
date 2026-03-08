import { PushPlatform } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  registerPushToken
} from "../services/notification.service";

const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  unreadOnly: z.union([z.literal("true"), z.literal("false")]).optional()
});

const registerPushTokenSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.nativeEnum(PushPlatform)
});

const getRouteParam = (value: string | string[] | undefined, name: string): string => {
  if (Array.isArray(value)) {
    if (value.length === 0 || !value[0]) {
      throw new AppError(`Missing ${name}.`, 400);
    }
    return value[0];
  }

  if (!value) {
    throw new AppError(`Missing ${name}.`, 400);
  }

  return value;
};

export const listNotificationsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const query = listNotificationsQuerySchema.parse(req.query);
  const result = await listNotifications({
    userId: req.user.id,
    limit: query.limit,
    unreadOnly: query.unreadOnly === "true"
  });

  return res.json(result);
};

export const markNotificationAsReadController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const notificationId = getRouteParam(req.params.notificationId, "notificationId");
  await markNotificationAsRead(req.user.id, notificationId);
  return res.status(204).send();
};

export const markAllNotificationsAsReadController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const updated = await markAllNotificationsAsRead(req.user.id);
  return res.json({ updated });
};

export const registerPushTokenController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = registerPushTokenSchema.parse(req.body);
  await registerPushToken({
    userId: req.user.id,
    token: payload.token,
    platform: payload.platform
  });

  return res.status(204).send();
};

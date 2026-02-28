import { WorkEventType } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import { addManualAdjustment, getTodayStatus, registerEvent } from "../services/attendance.service";

const eventInputSchema = z.object({
  source: z.enum(["WEB", "MOBILE"]).default("WEB"),
  note: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

const adjustmentSchema = z.object({
  userId: z.string().min(1),
  minutesDelta: z.number().int().min(-720).max(720),
  note: z.string().min(5).max(500)
});

const getClientIp = (req: Request) => {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0]?.trim();
  }
  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return xForwardedFor[0];
  }
  return req.socket.remoteAddress;
};

const buildEventHandler = (eventType: WorkEventType) => {
  return async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Not authenticated.", 401);
    }

    const payload = eventInputSchema.parse(req.body ?? {});

    const event = await registerEvent({
      userId: req.user.id,
      type: eventType,
      source: payload.source,
      note: payload.note,
      latitude: payload.latitude,
      longitude: payload.longitude,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"]
    });

    return res.status(201).json(event);
  };
};

export const clockInController = buildEventHandler(WorkEventType.CLOCK_IN);
export const breakStartController = buildEventHandler(WorkEventType.BREAK_START);
export const breakEndController = buildEventHandler(WorkEventType.BREAK_END);
export const clockOutController = buildEventHandler(WorkEventType.CLOCK_OUT);

export const todayStatusController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const status = await getTodayStatus(req.user.id);
  return res.json(status);
};

export const manualAdjustmentController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = adjustmentSchema.parse(req.body);

  const event = await addManualAdjustment({
    userId: payload.userId,
    adminId: req.user.id,
    minutesDelta: payload.minutesDelta,
    note: payload.note
  });

  return res.status(201).json(event);
};

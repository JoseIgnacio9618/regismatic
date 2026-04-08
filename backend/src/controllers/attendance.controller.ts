import { EditRequestStatus, WorkEventType } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import {
  addManualAdjustment,
  createEditRequest,
  getTodayStatus,
  listEditRequests,
  listEvents,
  registerEvent,
  reviewEditRequest,
  updateEventAsAdmin
} from "../services/attendance.service";
import { assertNonBillingFeatureAccessForUser } from "../services/billing.service";
import { parseOptionalReportRange } from "../utils/report-range";
import { strictObject } from "../utils/validation";

const eventInputSchema = strictObject({
  source: z.enum(["WEB", "MOBILE"]).default("WEB"),
  note: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

const adjustmentSchema = strictObject({
  userId: z.string().min(1),
  minutesDelta: z.number().int().min(-720).max(720),
  note: z.string().min(5).max(500)
});

const listEventsQuerySchema = strictObject({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

const updateEventSchema = strictObject({
    eventAt: z.coerce.date().optional(),
    note: z.string().max(500).nullable().optional(),
    reason: z.string().min(5).max(500)
  })
  .refine((payload) => payload.eventAt !== undefined || payload.note !== undefined, {
    message: "Debes indicar eventAt o note para modificar el registro."
  });

const createEditRequestSchema = strictObject({
  requestedEventAt: z.coerce.date(),
  requestedNote: z.string().max(500).nullable().optional(),
  reason: z.string().min(5).max(500)
});

const listEditRequestsQuerySchema = strictObject({
  status: z.nativeEnum(EditRequestStatus).optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

const reviewEditRequestSchema = strictObject({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewComment: z.string().max(500).optional()
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

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const payload = adjustmentSchema.parse(req.body);

  const event = await addManualAdjustment({
    userId: payload.userId,
    adminId: req.user.id,
    minutesDelta: payload.minutesDelta,
    note: payload.note
  });

  return res.status(201).json(event);
};

export const listEventsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const query = listEventsQuerySchema.parse(req.query);
  const range = parseOptionalReportRange(query.from, query.to);
  const result = await listEvents({
    fromUtc: range.fromUtc,
    toUtc: range.toUtc,
    requesterRole: req.user.role,
    requesterUserId: req.user.id,
    userId: query.userId,
    page: query.page,
    pageSize: query.pageSize
  });

  return res.json(result);
};

export const updateEventController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const payload = updateEventSchema.parse(req.body);
  const eventId = getRouteParam(req.params.eventId, "eventId");

  const event = await updateEventAsAdmin({
    eventId,
    adminId: req.user.id,
    eventAt: payload.eventAt,
    note: payload.note,
    reason: payload.reason
  });

  return res.json(event);
};

export const createEditRequestController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  if (req.user.role !== "EMPLOYEE") {
    throw new AppError("Solo los empleados pueden crear solicitudes.", 403);
  }

  const eventId = getRouteParam(req.params.eventId, "eventId");

  const payload = createEditRequestSchema.parse(req.body);
  const request = await createEditRequest({
    eventId,
    requesterId: req.user.id,
    requestedEventAt: payload.requestedEventAt,
    requestedNote: payload.requestedNote,
    reason: payload.reason
  });

  return res.status(201).json(request);
};

export const listEditRequestsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const query = listEditRequestsQuerySchema.parse(req.query);
  const result = await listEditRequests({
    requesterRole: req.user.role,
    requesterUserId: req.user.id,
    status: query.status,
    userId: query.userId,
    page: query.page,
    pageSize: query.pageSize
  });

  return res.json(result);
};

export const reviewEditRequestController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const requestId = getRouteParam(req.params.requestId, "requestId");

  const payload = reviewEditRequestSchema.parse(req.body);
  const request = await reviewEditRequest({
    requestId,
    adminId: req.user.id,
    approve: payload.action === "APPROVE",
    reviewComment: payload.reviewComment
  });

  return res.json(request);
};

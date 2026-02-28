import { Prisma, WorkEventType, type EventSource, type WorkEvent } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";
import { diffMinutes, madridDateKey, madridDayRange, nowUtc } from "../utils/dates";

export type AttendanceState = "OFF" | "WORKING" | "ON_BREAK";

type EventInput = {
  userId: string;
  type: WorkEventType;
  source?: EventSource;
  note?: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

const applyEventToState = (state: AttendanceState, eventType: WorkEventType): AttendanceState => {
  if (eventType === WorkEventType.MANUAL_ADJUSTMENT) {
    return state;
  }

  if (state === "OFF" && eventType === WorkEventType.CLOCK_IN) {
    return "WORKING";
  }

  if (state === "WORKING" && eventType === WorkEventType.BREAK_START) {
    return "ON_BREAK";
  }

  if (state === "ON_BREAK" && eventType === WorkEventType.BREAK_END) {
    return "WORKING";
  }

  if (state === "WORKING" && eventType === WorkEventType.CLOCK_OUT) {
    return "OFF";
  }

  throw new AppError("Invalid event sequence for current attendance state.", 409);
};

const sortEvents = (events: WorkEvent[]): WorkEvent[] => {
  return [...events].sort((a, b) => {
    const byEventAt = a.eventAt.getTime() - b.eventAt.getTime();
    if (byEventAt !== 0) {
      return byEventAt;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
};

const getStateFromEvents = (events: WorkEvent[]): AttendanceState => {
  let state: AttendanceState = "OFF";

  for (const event of sortEvents(events)) {
    state = applyEventToState(state, event.type);
  }

  return state;
};

const calculateDailyTotals = (events: WorkEvent[]) => {
  const ordered = sortEvents(events);
  let workedMinutes = 0;
  let breakMinutes = 0;
  let adjustmentsMinutes = 0;
  let state: AttendanceState = "OFF";
  let workStart: Date | null = null;
  let breakStart: Date | null = null;

  for (const event of ordered) {
    if (event.type === WorkEventType.MANUAL_ADJUSTMENT) {
      const maybeMinutes = Number((event.metadata as Record<string, unknown> | null)?.minutesDelta ?? 0);
      if (!Number.isNaN(maybeMinutes)) {
        adjustmentsMinutes += Math.round(maybeMinutes);
      }
      continue;
    }

    if (event.type === WorkEventType.CLOCK_IN) {
      state = "WORKING";
      workStart = event.eventAt;
      continue;
    }

    if (event.type === WorkEventType.BREAK_START && state === "WORKING" && workStart) {
      workedMinutes += diffMinutes(workStart, event.eventAt);
      breakStart = event.eventAt;
      workStart = null;
      state = "ON_BREAK";
      continue;
    }

    if (event.type === WorkEventType.BREAK_END && state === "ON_BREAK" && breakStart) {
      breakMinutes += diffMinutes(breakStart, event.eventAt);
      breakStart = null;
      workStart = event.eventAt;
      state = "WORKING";
      continue;
    }

    if (event.type === WorkEventType.CLOCK_OUT) {
      if (state === "WORKING" && workStart) {
        workedMinutes += diffMinutes(workStart, event.eventAt);
      }
      state = "OFF";
      workStart = null;
      breakStart = null;
    }
  }

  return {
    workedMinutes: Math.max(0, workedMinutes + adjustmentsMinutes),
    breakMinutes: Math.max(0, breakMinutes),
    adjustmentsMinutes,
    overtimeMinutes: Math.max(0, workedMinutes + adjustmentsMinutes - 8 * 60)
  };
};

const getTodayEvents = async (userId: string) => {
  const { start, end } = madridDayRange(nowUtc());

  return prisma.workEvent.findMany({
    where: {
      userId,
      eventAt: {
        gte: start,
        lte: end
      }
    },
    orderBy: [{ eventAt: "asc" }, { createdAt: "asc" }]
  });
};

export const getTodayStatus = async (userId: string) => {
  const events = await getTodayEvents(userId);
  const state = getStateFromEvents(events);
  const totals = calculateDailyTotals(events);

  return {
    date: madridDateKey(nowUtc()),
    state,
    totals,
    events
  };
};

export const registerEvent = async (input: EventInput) => {
  const todayEvents = await getTodayEvents(input.userId);
  const state = getStateFromEvents(todayEvents);

  applyEventToState(state, input.type);

  return prisma.workEvent.create({
    data: {
      userId: input.userId,
      type: input.type,
      source: input.source ?? "WEB",
      note: input.note,
      latitude: input.latitude,
      longitude: input.longitude,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      eventAt: nowUtc()
    }
  });
};

export const addManualAdjustment = async (params: {
  userId: string;
  adminId: string;
  minutesDelta: number;
  note: string;
}) => {
  if (params.minutesDelta === 0) {
    throw new AppError("minutesDelta cannot be zero.", 400);
  }

  return prisma.workEvent.create({
    data: {
      userId: params.userId,
      type: WorkEventType.MANUAL_ADJUSTMENT,
      source: "ADMIN",
      note: params.note,
      metadata: {
        minutesDelta: params.minutesDelta,
        adjustedBy: params.adminId
      },
      eventAt: nowUtc()
    }
  });
};

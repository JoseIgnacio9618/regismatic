import {
  EditRequestStatus,
  NotificationType,
  Prisma,
  type EventSource,
  type Role,
  type WorkEvent,
  WorkEventType
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";
import { diffMinutes, madridDateKey, madridDayRange, nowUtc } from "../utils/dates";
import { createNotificationsForUsers, listAdminUsers } from "./notification.service";

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

type ListEventsParams = {
  fromUtc: Date;
  toUtc: Date;
  requesterRole: Role;
  requesterUserId: string;
  userId?: string;
};

type UpdateEventByAdminParams = {
  eventId: string;
  adminId: string;
  eventAt?: Date;
  note?: string | null;
  reason: string;
};

type CreateEditRequestParams = {
  eventId: string;
  requesterId: string;
  requestedEventAt: Date;
  requestedNote?: string | null;
  reason: string;
};

type ListEditRequestsParams = {
  requesterRole: Role;
  requesterUserId: string;
  status?: EditRequestStatus;
  userId?: string;
};

type ReviewEditRequestParams = {
  requestId: string;
  adminId: string;
  approve: boolean;
  reviewComment?: string;
};

type UserSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type WorkEventEditRequestRecord = {
  id: string;
  status: EditRequestStatus;
  reason: string;
  requestedEventAt: Date;
  requestedNote: string | null;
  reviewComment: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  requestedBy: UserSummary;
  reviewedBy: UserSummary | null;
  workEvent: {
    id: string;
    type: WorkEventType;
    eventAt: Date;
    user: UserSummary;
  };
};

export type AttendanceEventRecord = {
  id: string;
  userId: string;
  type: WorkEventType;
  source: EventSource;
  eventAt: Date;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  modifiedAt: Date | null;
  modificationReason: string | null;
  user: UserSummary;
  modifiedBy: UserSummary | null;
  editRequests: Array<{
    id: string;
    status: EditRequestStatus;
    reason: string;
    requestedEventAt: Date;
    requestedNote: string | null;
    reviewComment: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    requestedBy: UserSummary;
    reviewedBy: UserSummary | null;
  }>;
};

const eventInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true
    }
  },
  modifiedBy: {
    select: {
      id: true,
      fullName: true,
      email: true
    }
  },
  editRequests: {
    include: {
      requestedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      reviewedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  }
} satisfies Prisma.WorkEventInclude;

type WorkEventWithRelations = Prisma.WorkEventGetPayload<{ include: typeof eventInclude }>;
type EditRequestWithRelations = Prisma.WorkEventEditRequestGetPayload<{
  include: {
    requestedBy: { select: { id: true; fullName: true; email: true } };
    reviewedBy: { select: { id: true; fullName: true; email: true } };
    workEvent: {
      include: {
        user: { select: { id: true; fullName: true; email: true } };
      };
    };
  };
}>;

const normalizeOptionalText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const isSameMinuteMoment = (left: Date, right: Date): boolean => {
  return Math.abs(left.getTime() - right.getTime()) < 60_000;
};

const normalizeEventAtChange = (currentEventAt: Date, nextEventAt: Date): Date => {
  return isSameMinuteMoment(currentEventAt, nextEventAt) ? currentEventAt : nextEventAt;
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

const mapAttendanceEvent = (event: WorkEventWithRelations): AttendanceEventRecord => {
  return {
    id: event.id,
    userId: event.userId,
    type: event.type,
    source: event.source,
    eventAt: event.eventAt,
    note: event.note ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    createdAt: event.createdAt,
    modifiedAt: event.modifiedAt ?? null,
    modificationReason: event.modificationReason ?? null,
    user: event.user,
    modifiedBy: event.modifiedBy ?? null,
    editRequests: event.editRequests.map((request) => ({
      id: request.id,
      status: request.status,
      reason: request.reason,
      requestedEventAt: request.requestedEventAt,
      requestedNote: request.requestedNote ?? null,
      reviewComment: request.reviewComment ?? null,
      reviewedAt: request.reviewedAt ?? null,
      createdAt: request.createdAt,
      requestedBy: request.requestedBy,
      reviewedBy: request.reviewedBy ?? null
    }))
  };
};

const mapEditRequest = (request: EditRequestWithRelations): WorkEventEditRequestRecord => {
  return {
    id: request.id,
    status: request.status,
    reason: request.reason,
    requestedEventAt: request.requestedEventAt,
    requestedNote: request.requestedNote ?? null,
    reviewComment: request.reviewComment ?? null,
    reviewedAt: request.reviewedAt ?? null,
    createdAt: request.createdAt,
    requestedBy: request.requestedBy,
    reviewedBy: request.reviewedBy ?? null,
    workEvent: {
      id: request.workEvent.id,
      type: request.workEvent.type,
      eventAt: request.workEvent.eventAt,
      user: request.workEvent.user
    }
  };
};

const notifySafely = async (task: () => Promise<void>): Promise<void> => {
  try {
    await task();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Notification dispatch failed.", error);
  }
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
    include: {
      modifiedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: [{ eventAt: "asc" }, { createdAt: "asc" }]
  });
};

const getEventsForMadridDay = async (userId: string, referenceDate: Date): Promise<WorkEvent[]> => {
  const { start, end } = madridDayRange(referenceDate);

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

const assertValidDaySequence = (events: WorkEvent[]) => {
  getStateFromEvents(events);
};

const assertValidTimelineAfterEventDateChange = async (event: WorkEvent, nextEventAt: Date) => {
  if (event.type === WorkEventType.MANUAL_ADJUSTMENT) {
    return;
  }

  const oldDayKey = madridDateKey(event.eventAt);
  const newDayKey = madridDateKey(nextEventAt);
  const oldDayEvents = await getEventsForMadridDay(event.userId, event.eventAt);

  if (oldDayKey === newDayKey) {
    const nextDayEvents = oldDayEvents.map((existing) =>
      existing.id === event.id ? { ...existing, eventAt: nextEventAt } : existing
    );
    assertValidDaySequence(nextDayEvents);
    return;
  }

  const oldDayWithoutEvent = oldDayEvents.filter((existing) => existing.id !== event.id);
  assertValidDaySequence(oldDayWithoutEvent);

  const newDayEvents = await getEventsForMadridDay(event.userId, nextEventAt);
  const newDayWithEvent: WorkEvent[] = [...newDayEvents, { ...event, eventAt: nextEventAt }];
  assertValidDaySequence(newDayWithEvent);
};

const getEventForUser = async (eventId: string, userId: string): Promise<WorkEvent> => {
  const event = await prisma.workEvent.findFirst({
    where: {
      id: eventId,
      userId
    }
  });

  if (!event) {
    throw new AppError("Registro no encontrado.", 404);
  }

  return event;
};

const getEventForAdmin = async (eventId: string): Promise<WorkEvent> => {
  const event = await prisma.workEvent.findUnique({
    where: {
      id: eventId
    }
  });

  if (!event) {
    throw new AppError("Registro no encontrado.", 404);
  }

  return event;
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

export const listEvents = async (params: ListEventsParams): Promise<AttendanceEventRecord[]> => {
  const effectiveUserId = params.requesterRole === "ADMIN" ? params.userId : params.requesterUserId;

  const events = await prisma.workEvent.findMany({
    where: {
      eventAt: {
        gte: params.fromUtc,
        lte: params.toUtc
      },
      ...(effectiveUserId ? { userId: effectiveUserId } : {})
    },
    include: eventInclude,
    orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }]
  });

  return events.map((event) => mapAttendanceEvent(event));
};

export const updateEventAsAdmin = async (params: UpdateEventByAdminParams): Promise<AttendanceEventRecord> => {
  const event = await getEventForAdmin(params.eventId);
  const nextEventAtCandidate = params.eventAt ?? event.eventAt;
  const nextEventAt = normalizeEventAtChange(event.eventAt, nextEventAtCandidate);
  if (!isSameMinuteMoment(event.eventAt, nextEventAt)) {
    await assertValidTimelineAfterEventDateChange(event, nextEventAt);
  }
  const reason = normalizeOptionalText(params.reason);
  if (!reason) {
    throw new AppError("El motivo de modificacion es obligatorio.", 400);
  }

  const nextNote = normalizeOptionalText(params.note);
  const updated = await prisma.workEvent.update({
    where: { id: event.id },
    data: {
      eventAt: nextEventAt,
      note: nextNote === undefined ? event.note : nextNote,
      modifiedAt: nowUtc(),
      modifiedById: params.adminId,
      modificationReason: reason
    },
    include: eventInclude
  });

  if (event.userId !== params.adminId) {
    await notifySafely(async () => {
      await createNotificationsForUsers({
        userIds: [event.userId],
        type: NotificationType.EVENT_MODIFIED,
        title: "Registro modificado por administracion",
        body: "Un administrador ha modificado uno de tus fichajes.",
        metadata: {
          eventId: event.id,
          route: "/reports"
        },
        pushData: {
          eventId: event.id,
          route: "/reports"
        }
      });
    });
  }

  return mapAttendanceEvent(updated);
};

export const createEditRequest = async (params: CreateEditRequestParams): Promise<WorkEventEditRequestRecord> => {
  const event = await getEventForUser(params.eventId, params.requesterId);
  const reason = normalizeOptionalText(params.reason);
  if (!reason) {
    throw new AppError("El motivo de la solicitud es obligatorio.", 400);
  }

  const normalizedRequestedEventAt = normalizeEventAtChange(event.eventAt, params.requestedEventAt);

  const nextNoteCandidate = normalizeOptionalText(params.requestedNote);
  const nextNote = nextNoteCandidate === undefined ? event.note ?? null : nextNoteCandidate;

  const noDateChange = normalizedRequestedEventAt.getTime() === event.eventAt.getTime();
  const noNoteChange = (nextNote ?? null) === (event.note ?? null);
  if (noDateChange && noNoteChange) {
    throw new AppError("La solicitud no contiene cambios respecto al registro actual.", 400);
  }

  const existingPendingRequest = await prisma.workEventEditRequest.findFirst({
    where: {
      workEventId: event.id,
      requestedById: params.requesterId,
      status: EditRequestStatus.PENDING
    },
    select: { id: true }
  });

  if (existingPendingRequest) {
    throw new AppError("Ya tienes una solicitud pendiente para este registro.", 409);
  }

  const created = await prisma.workEventEditRequest.create({
    data: {
      workEventId: event.id,
      requestedById: params.requesterId,
      requestedEventAt: normalizedRequestedEventAt,
      requestedNote: nextNote,
      reason
    },
    include: {
      requestedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      reviewedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      workEvent: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      }
    }
  });

  await notifySafely(async () => {
    const admins = await listAdminUsers();
    await createNotificationsForUsers({
      userIds: admins.map((admin) => admin.id),
      type: NotificationType.EDIT_REQUEST_CREATED,
      title: "Nueva solicitud de correccion",
      body: `${created.requestedBy.fullName} ha enviado una solicitud de correccion.`,
      metadata: {
        requestId: created.id,
        requestedById: created.requestedBy.id,
        route: "/reports?focus=incidents"
      },
      pushData: {
        requestId: created.id,
        route: "/reports?focus=incidents"
      }
    });
  });

  return mapEditRequest(created);
};

export const listEditRequests = async (params: ListEditRequestsParams): Promise<WorkEventEditRequestRecord[]> => {
  const where: Prisma.WorkEventEditRequestWhereInput = {
    ...(params.status ? { status: params.status } : {})
  };

  if (params.requesterRole === "ADMIN") {
    if (params.userId) {
      where.requestedById = params.userId;
    }
  } else {
    where.requestedById = params.requesterUserId;
  }

  const requests = await prisma.workEventEditRequest.findMany({
    where,
    include: {
      requestedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      reviewedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      workEvent: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });

  return requests.map((request) => mapEditRequest(request));
};

export const reviewEditRequest = async (params: ReviewEditRequestParams): Promise<WorkEventEditRequestRecord> => {
  const request = await prisma.workEventEditRequest.findUnique({
    where: { id: params.requestId },
    include: {
      workEvent: true
    }
  });

  if (!request) {
    throw new AppError("Solicitud no encontrada.", 404);
  }

  if (request.status !== EditRequestStatus.PENDING) {
    throw new AppError("La solicitud ya fue revisada.", 409);
  }

  const reviewComment = normalizeOptionalText(params.reviewComment) ?? null;

  if (!params.approve) {
    const rejected = await prisma.workEventEditRequest.update({
      where: { id: request.id },
      data: {
        status: EditRequestStatus.REJECTED,
        reviewedById: params.adminId,
        reviewedAt: nowUtc(),
        reviewComment
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        workEvent: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      }
    });

    await notifySafely(async () => {
      await createNotificationsForUsers({
        userIds: [rejected.requestedBy.id],
        type: NotificationType.EDIT_REQUEST_REJECTED,
        title: "Solicitud de correccion rechazada",
        body: "Tu solicitud de correccion ha sido rechazada por administracion.",
        metadata: {
          requestId: rejected.id,
          route: "/reports"
        },
        pushData: {
          requestId: rejected.id,
          route: "/reports"
        }
      });
    });

    return mapEditRequest(rejected);
  }

  const approvedEventAt = normalizeEventAtChange(request.workEvent.eventAt, request.requestedEventAt);
  if (!isSameMinuteMoment(request.workEvent.eventAt, approvedEventAt)) {
    await assertValidTimelineAfterEventDateChange(request.workEvent, approvedEventAt);
  }

  const approved = await prisma.$transaction(async (tx) => {
    await tx.workEvent.update({
      where: { id: request.workEvent.id },
      data: {
        eventAt: approvedEventAt,
        note: request.requestedNote,
        modifiedAt: nowUtc(),
        modifiedById: params.adminId,
        modificationReason: request.reason
      }
    });

    return tx.workEventEditRequest.update({
      where: { id: request.id },
      data: {
        status: EditRequestStatus.APPROVED,
        reviewedById: params.adminId,
        reviewedAt: nowUtc(),
        reviewComment
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        workEvent: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      }
    });
  });

  await notifySafely(async () => {
    await createNotificationsForUsers({
      userIds: [approved.requestedBy.id],
      type: NotificationType.EDIT_REQUEST_APPROVED,
      title: "Solicitud de correccion aprobada",
      body: "Tu solicitud de correccion ha sido aprobada.",
      metadata: {
        requestId: approved.id,
        route: "/reports"
      },
      pushData: {
        requestId: approved.id,
        route: "/reports"
      }
    });
  });

  return mapEditRequest(approved);
};

import { WorkEventType, type WorkEvent } from "@prisma/client";
import { Parser } from "json2csv";
import { prisma } from "../config/prisma";
import { diffMinutes, madridDateKey } from "../utils/dates";

type ReportParams = {
  fromUtc: Date;
  toUtc: Date;
  requesterRole: "ADMIN" | "EMPLOYEE";
  requesterUserId: string;
  userId?: string;
};

export type SummaryRow = {
  date: string;
  userId: string;
  employee: string;
  email: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  adjustmentsMinutes: number;
  status: "OPEN" | "CLOSED";
};

const sortEvents = (events: WorkEvent[]): WorkEvent[] => {
  return [...events].sort((a, b) => {
    const byEvent = a.eventAt.getTime() - b.eventAt.getTime();
    if (byEvent !== 0) {
      return byEvent;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
};

const buildDailySummary = (events: WorkEvent[]) => {
  const ordered = sortEvents(events);
  let workedMinutes = 0;
  let breakMinutes = 0;
  let adjustmentsMinutes = 0;
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;
  let state: "OFF" | "WORKING" | "ON_BREAK" = "OFF";
  let workStart: Date | null = null;
  let breakStart: Date | null = null;

  for (const event of ordered) {
    if (event.type === WorkEventType.MANUAL_ADJUSTMENT) {
      const delta = Number((event.metadata as Record<string, unknown> | null)?.minutesDelta ?? 0);
      if (!Number.isNaN(delta)) {
        adjustmentsMinutes += Math.round(delta);
      }
      continue;
    }

    if (event.type === WorkEventType.CLOCK_IN) {
      state = "WORKING";
      workStart = event.eventAt;
      firstIn = firstIn ?? event.eventAt;
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
      lastOut = event.eventAt;
    }
  }

  const realWorked = Math.max(0, workedMinutes + adjustmentsMinutes);

  return {
    firstIn,
    lastOut,
    workedMinutes: realWorked,
    breakMinutes,
    overtimeMinutes: Math.max(0, realWorked - 8 * 60),
    adjustmentsMinutes,
    status: state === "OFF" ? "CLOSED" as const : "OPEN" as const
  };
};

export const getSummaryReport = async (params: ReportParams): Promise<SummaryRow[]> => {
  const userFilter = params.requesterRole === "ADMIN" ? params.userId : params.requesterUserId;

  const events = await prisma.workEvent.findMany({
    where: {
      eventAt: {
        gte: params.fromUtc,
        lte: params.toUtc
      },
      ...(userFilter ? { userId: userFilter } : {})
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: [{ eventAt: "asc" }, { createdAt: "asc" }]
  });

  const grouped = new Map<string, WorkEvent[]>();
  const userByGroup = new Map<string, { id: string; fullName: string; email: string }>();

  for (const event of events) {
    const date = madridDateKey(event.eventAt);
    const key = `${event.userId}::${date}`;
    const current = grouped.get(key) ?? [];
    current.push(event);
    grouped.set(key, current);
    userByGroup.set(key, {
      id: event.user.id,
      fullName: event.user.fullName,
      email: event.user.email
    });
  }

  const rows: SummaryRow[] = [];

  for (const [key, groupedEvents] of grouped.entries()) {
    const [userId, date] = key.split("::");
    const user = userByGroup.get(key);
    if (!user) {
      continue;
    }

    const summary = buildDailySummary(groupedEvents);

    rows.push({
      date,
      userId,
      employee: user.fullName,
      email: user.email,
      firstIn: summary.firstIn ? summary.firstIn.toISOString() : null,
      lastOut: summary.lastOut ? summary.lastOut.toISOString() : null,
      workedMinutes: summary.workedMinutes,
      breakMinutes: summary.breakMinutes,
      overtimeMinutes: summary.overtimeMinutes,
      adjustmentsMinutes: summary.adjustmentsMinutes,
      status: summary.status
    });
  }

  return rows.sort((a, b) => {
    if (a.date === b.date) {
      return a.employee.localeCompare(b.employee);
    }
    return a.date.localeCompare(b.date);
  });
};

export const summaryToCsv = (rows: SummaryRow[]): string => {
  const parser = new Parser({
    fields: [
      "date",
      "employee",
      "email",
      "firstIn",
      "lastOut",
      "workedMinutes",
      "breakMinutes",
      "overtimeMinutes",
      "adjustmentsMinutes",
      "status"
    ]
  });

  return parser.parse(rows);
};

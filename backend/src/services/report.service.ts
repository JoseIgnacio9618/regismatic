import { WorkEventType, type WorkEvent } from "@prisma/client";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
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

const minutesToHourNumber = (minutes: number): number => {
  return Math.round((minutes / 60) * 100) / 100;
};

export const summaryToExcelBuffer = async (rows: SummaryRow[]): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Regismatic";
  workbook.created = new Date();
  workbook.modified = new Date();

  const detailSheet = workbook.addWorksheet("Detalle diario");
  detailSheet.columns = [
    { header: "Fecha", key: "date", width: 14 },
    { header: "Empleado", key: "employee", width: 26 },
    { header: "Email", key: "email", width: 30 },
    { header: "Primera entrada", key: "firstIn", width: 22 },
    { header: "Ultima salida", key: "lastOut", width: 22 },
    { header: "Trabajo (min)", key: "workedMinutes", width: 15 },
    { header: "Pausa (min)", key: "breakMinutes", width: 13 },
    { header: "Extra (min)", key: "overtimeMinutes", width: 13 },
    { header: "Ajustes (min)", key: "adjustmentsMinutes", width: 14 },
    { header: "Trabajo (h)", key: "workedHours", width: 12 },
    { header: "Estado", key: "status", width: 12 }
  ];

  for (const row of rows) {
    detailSheet.addRow({
      date: row.date,
      employee: row.employee,
      email: row.email,
      firstIn: row.firstIn ?? "",
      lastOut: row.lastOut ?? "",
      workedMinutes: row.workedMinutes,
      breakMinutes: row.breakMinutes,
      overtimeMinutes: row.overtimeMinutes,
      adjustmentsMinutes: row.adjustmentsMinutes,
      workedHours: minutesToHourNumber(row.workedMinutes),
      status: row.status
    });
  }

  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  detailSheet.views = [{ state: "frozen", ySplit: 1 }];
  if (rows.length > 0) {
    detailSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 11 }
    };
  }

  const byEmployee = new Map<
    string,
    {
      employee: string;
      email: string;
      days: number;
      workedMinutes: number;
      breakMinutes: number;
      overtimeMinutes: number;
      adjustmentsMinutes: number;
    }
  >();

  const byDate = new Map<
    string,
    {
      date: string;
      employees: number;
      workedMinutes: number;
      breakMinutes: number;
      overtimeMinutes: number;
      adjustmentsMinutes: number;
    }
  >();

  for (const row of rows) {
    const employeeCurrent = byEmployee.get(row.userId) ?? {
      employee: row.employee,
      email: row.email,
      days: 0,
      workedMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      adjustmentsMinutes: 0
    };
    employeeCurrent.days += 1;
    employeeCurrent.workedMinutes += row.workedMinutes;
    employeeCurrent.breakMinutes += row.breakMinutes;
    employeeCurrent.overtimeMinutes += row.overtimeMinutes;
    employeeCurrent.adjustmentsMinutes += row.adjustmentsMinutes;
    byEmployee.set(row.userId, employeeCurrent);

    const dayCurrent = byDate.get(row.date) ?? {
      date: row.date,
      employees: 0,
      workedMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      adjustmentsMinutes: 0
    };
    dayCurrent.employees += 1;
    dayCurrent.workedMinutes += row.workedMinutes;
    dayCurrent.breakMinutes += row.breakMinutes;
    dayCurrent.overtimeMinutes += row.overtimeMinutes;
    dayCurrent.adjustmentsMinutes += row.adjustmentsMinutes;
    byDate.set(row.date, dayCurrent);
  }

  const employeeSheet = workbook.addWorksheet("Pivot empleado");
  employeeSheet.columns = [
    { header: "Empleado", key: "employee", width: 26 },
    { header: "Email", key: "email", width: 30 },
    { header: "Dias", key: "days", width: 10 },
    { header: "Trabajo (min)", key: "workedMinutes", width: 15 },
    { header: "Pausa (min)", key: "breakMinutes", width: 13 },
    { header: "Extra (min)", key: "overtimeMinutes", width: 13 },
    { header: "Ajustes (min)", key: "adjustmentsMinutes", width: 14 },
    { header: "Trabajo (h)", key: "workedHours", width: 12 }
  ];

  const employeeRows = Array.from(byEmployee.values()).sort((a, b) => a.employee.localeCompare(b.employee));
  for (const row of employeeRows) {
    employeeSheet.addRow({
      ...row,
      workedHours: minutesToHourNumber(row.workedMinutes)
    });
  }

  employeeSheet.getRow(1).font = { bold: true };
  employeeSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  employeeSheet.views = [{ state: "frozen", ySplit: 1 }];
  if (employeeRows.length > 0) {
    employeeSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 8 }
    };
  }

  const dateSheet = workbook.addWorksheet("Pivot fecha");
  dateSheet.columns = [
    { header: "Fecha", key: "date", width: 14 },
    { header: "Empleados", key: "employees", width: 12 },
    { header: "Trabajo (min)", key: "workedMinutes", width: 15 },
    { header: "Pausa (min)", key: "breakMinutes", width: 13 },
    { header: "Extra (min)", key: "overtimeMinutes", width: 13 },
    { header: "Ajustes (min)", key: "adjustmentsMinutes", width: 14 },
    { header: "Trabajo (h)", key: "workedHours", width: 12 }
  ];

  const dateRows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  for (const row of dateRows) {
    dateSheet.addRow({
      ...row,
      workedHours: minutesToHourNumber(row.workedMinutes)
    });
  }

  dateSheet.getRow(1).font = { bold: true };
  dateSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  dateSheet.views = [{ state: "frozen", ySplit: 1 }];
  if (dateRows.length > 0) {
    dateSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 7 }
    };
  }

  const infoSheet = workbook.addWorksheet("Guia");
  infoSheet.columns = [{ header: "Indicaciones", key: "guide", width: 120 }];
  infoSheet.getRow(1).font = { bold: true };
  infoSheet.addRow({
    guide:
      "Usa 'Detalle diario' para filtrar y auditar. Usa 'Pivot empleado' y 'Pivot fecha' como resumen de tablas dinamicas para analisis operativo."
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

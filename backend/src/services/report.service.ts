import { Prisma, WorkEventType, type Role, type WorkEvent } from "@prisma/client";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import { prisma } from "../config/prisma";
import { diffMinutes, madridDateKey } from "../utils/dates";
import { assertCanViewUser, getScopedUserById, listVisibleUserIds } from "./access.service";

type ReportLanguage = "es" | "en" | "fr";

type ReportParams = {
  fromUtc?: Date;
  toUtc?: Date;
  requesterRole: Role;
  requesterUserId: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  language?: ReportLanguage;
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

export type SummaryReportResult = {
  rows: SummaryRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type EventExportRow = {
  eventId: string;
  eventAt: string;
  date: string;
  time: string;
  userId: string;
  employee: string;
  email: string;
  type: string;
  typeCode: WorkEventType;
  source: string;
  sourceCode: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
  modifiedAt: string | null;
  modifiedBy: string | null;
  modificationReason: string | null;
  createdAt: string;
};

export type EditRequestExportRow = {
  requestId: string;
  eventId: string;
  employee: string;
  email: string;
  eventType: string;
  eventTypeCode: WorkEventType;
  originalEventAt: string;
  requestedEventAt: string;
  requestedNote: string | null;
  reason: string;
  status: string;
  statusCode: string;
  reviewComment: string | null;
  requestedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type DetailedReportExport = {
  meta: {
    language: ReportLanguage;
    generatedAt: string;
    scopeLabel: string;
    rangeLabel: string;
    recordsCount: number;
    rectificationsCount: number;
    employeesCount: number;
  };
  events: EventExportRow[];
  editRequests: EditRequestExportRow[];
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

const WORK_EVENT_TYPE_LABELS: Record<ReportLanguage, Record<WorkEventType, string>> = {
  es: {
    CLOCK_IN: "Entrada",
    BREAK_START: "Inicio pausa",
    BREAK_END: "Fin pausa",
    CLOCK_OUT: "Salida",
    MANUAL_ADJUSTMENT: "Ajuste manual"
  },
  en: {
    CLOCK_IN: "Clock in",
    BREAK_START: "Break start",
    BREAK_END: "Break end",
    CLOCK_OUT: "Clock out",
    MANUAL_ADJUSTMENT: "Manual adjustment"
  },
  fr: {
    CLOCK_IN: "Entree",
    BREAK_START: "Debut pause",
    BREAK_END: "Fin pause",
    CLOCK_OUT: "Sortie",
    MANUAL_ADJUSTMENT: "Ajustement manuel"
  }
};

const resolveReportLanguage = (language: ReportLanguage | undefined): ReportLanguage => {
  return language === "en" || language === "fr" ? language : "es";
};

const translateWorkEventType = (type: WorkEventType, language: ReportLanguage | undefined): string => {
  const resolvedLanguage = resolveReportLanguage(language);
  return WORK_EVENT_TYPE_LABELS[resolvedLanguage][type] ?? WORK_EVENT_TYPE_LABELS.es[type] ?? type;
};

const REPORT_LOCALE_BY_LANGUAGE: Record<ReportLanguage, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR"
};

const EVENT_SOURCE_LABELS: Record<ReportLanguage, Record<string, string>> = {
  es: {
    WEB: "Web",
    MOBILE: "Movil",
    ADMIN: "Admin",
    SYSTEM: "Sistema"
  },
  en: {
    WEB: "Web",
    MOBILE: "Mobile",
    ADMIN: "Admin",
    SYSTEM: "System"
  },
  fr: {
    WEB: "Web",
    MOBILE: "Mobile",
    ADMIN: "Admin",
    SYSTEM: "Systeme"
  }
};

const EDIT_REQUEST_STATUS_LABELS: Record<ReportLanguage, Record<string, string>> = {
  es: {
    PENDING: "Pendiente",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada"
  },
  en: {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected"
  },
  fr: {
    PENDING: "En attente",
    APPROVED: "Approuvee",
    REJECTED: "Rejetee"
  }
};

const REPORT_TEXT: Record<
  ReportLanguage,
  {
    locale: string;
    sheets: {
      summary: string;
      events: string;
      editRequests: string;
      guide: string;
    };
    summary: {
      title: string;
      subtitle: string;
      generatedAt: string;
      scope: string;
      range: string;
      records: string;
      rectifications: string;
      employees: string;
      noDateFilter: string;
      allVisibleUsers: string;
      adminTeamScope: string;
      guideTitle: string;
    };
    guide: string[];
    eventColumns: {
      eventId: string;
      eventAt: string;
      date: string;
      time: string;
      employee: string;
      email: string;
      type: string;
      source: string;
      note: string;
      latitude: string;
      longitude: string;
      modifiedAt: string;
      modifiedBy: string;
      modificationReason: string;
      createdAt: string;
    };
    editColumns: {
      requestId: string;
      eventId: string;
      employee: string;
      email: string;
      eventType: string;
      originalEventAt: string;
      requestedEventAt: string;
      requestedNote: string;
      reason: string;
      status: string;
      reviewComment: string;
      requestedBy: string;
      reviewedBy: string;
      reviewedAt: string;
      createdAt: string;
    };
  }
> = {
  es: {
    locale: REPORT_LOCALE_BY_LANGUAGE.es,
    sheets: {
      summary: "Resumen",
      events: "Registros",
      editRequests: "Rectificaciones",
      guide: "Guia"
    },
    summary: {
      title: "Resumen del export",
      subtitle: "Archivo preparado para lectura, filtro y revision operativa.",
      generatedAt: "Generado el",
      scope: "Ambito",
      range: "Rango",
      records: "Registros exportados",
      rectifications: "Rectificaciones exportadas",
      employees: "Empleados incluidos",
      noDateFilter: "Sin filtro de fechas",
      allVisibleUsers: "Todos los usuarios visibles",
      adminTeamScope: "Mi cuenta y equipo",
      guideTitle: "Lectura rapida"
    },
    guide: [
      "Usa la hoja 'Registros' para filtrar y auditar fichajes completos.",
      "Usa la hoja 'Rectificaciones' para revisar solicitudes asociadas a esos registros.",
      "Las columnas de fecha y hora estan listas para ordenar y filtrar desde Excel."
    ],
    eventColumns: {
      eventId: "ID",
      eventAt: "Fecha y hora",
      date: "Fecha",
      time: "Hora",
      employee: "Empleado",
      email: "Email",
      type: "Tipo",
      source: "Fuente",
      note: "Nota",
      latitude: "Latitud",
      longitude: "Longitud",
      modifiedAt: "Modificado el",
      modifiedBy: "Modificado por",
      modificationReason: "Motivo modificacion",
      createdAt: "Creado el"
    },
    editColumns: {
      requestId: "Solicitud ID",
      eventId: "Registro ID",
      employee: "Empleado",
      email: "Email",
      eventType: "Tipo evento",
      originalEventAt: "Fecha original",
      requestedEventAt: "Fecha solicitada",
      requestedNote: "Nota solicitada",
      reason: "Motivo",
      status: "Estado",
      reviewComment: "Comentario revision",
      requestedBy: "Solicitado por",
      reviewedBy: "Revisado por",
      reviewedAt: "Revisado el",
      createdAt: "Creado el"
    }
  },
  en: {
    locale: REPORT_LOCALE_BY_LANGUAGE.en,
    sheets: {
      summary: "Summary",
      events: "Records",
      editRequests: "Corrections",
      guide: "Guide"
    },
    summary: {
      title: "Export summary",
      subtitle: "Workbook prepared for quick reading, filtering, and review.",
      generatedAt: "Generated at",
      scope: "Scope",
      range: "Range",
      records: "Exported records",
      rectifications: "Exported corrections",
      employees: "Included employees",
      noDateFilter: "No date filter",
      allVisibleUsers: "All visible users",
      adminTeamScope: "My account and team",
      guideTitle: "Quick reading"
    },
    guide: [
      "Use 'Records' to filter and audit the complete time log.",
      "Use 'Corrections' to review requests linked to those records.",
      "Date and time columns are ready for sorting and filtering inside Excel."
    ],
    eventColumns: {
      eventId: "ID",
      eventAt: "Date and time",
      date: "Date",
      time: "Time",
      employee: "Employee",
      email: "Email",
      type: "Type",
      source: "Source",
      note: "Note",
      latitude: "Latitude",
      longitude: "Longitude",
      modifiedAt: "Modified at",
      modifiedBy: "Modified by",
      modificationReason: "Modification reason",
      createdAt: "Created at"
    },
    editColumns: {
      requestId: "Request ID",
      eventId: "Record ID",
      employee: "Employee",
      email: "Email",
      eventType: "Event type",
      originalEventAt: "Original date",
      requestedEventAt: "Requested date",
      requestedNote: "Requested note",
      reason: "Reason",
      status: "Status",
      reviewComment: "Review comment",
      requestedBy: "Requested by",
      reviewedBy: "Reviewed by",
      reviewedAt: "Reviewed at",
      createdAt: "Created at"
    }
  },
  fr: {
    locale: REPORT_LOCALE_BY_LANGUAGE.fr,
    sheets: {
      summary: "Resume",
      events: "Registres",
      editRequests: "Rectifications",
      guide: "Guide"
    },
    summary: {
      title: "Resume de l'export",
      subtitle: "Classeur prepare pour une lecture et un controle plus clairs.",
      generatedAt: "Genere le",
      scope: "Portee",
      range: "Periode",
      records: "Registres exportes",
      rectifications: "Rectifications exportees",
      employees: "Employes inclus",
      noDateFilter: "Sans filtre de dates",
      allVisibleUsers: "Tous les utilisateurs visibles",
      adminTeamScope: "Mon compte et mon equipe",
      guideTitle: "Lecture rapide"
    },
    guide: [
      "Utilisez 'Registres' pour filtrer et auditer les pointages complets.",
      "Utilisez 'Rectifications' pour examiner les demandes liees a ces registres.",
      "Les colonnes de date et d'heure sont pretes pour le tri et le filtre dans Excel."
    ],
    eventColumns: {
      eventId: "ID",
      eventAt: "Date et heure",
      date: "Date",
      time: "Heure",
      employee: "Employe",
      email: "Email",
      type: "Type",
      source: "Source",
      note: "Note",
      latitude: "Latitude",
      longitude: "Longitude",
      modifiedAt: "Modifie le",
      modifiedBy: "Modifie par",
      modificationReason: "Motif de modification",
      createdAt: "Cree le"
    },
    editColumns: {
      requestId: "Demande ID",
      eventId: "Registre ID",
      employee: "Employe",
      email: "Email",
      eventType: "Type d'evenement",
      originalEventAt: "Date originale",
      requestedEventAt: "Date demandee",
      requestedNote: "Note demandee",
      reason: "Motif",
      status: "Etat",
      reviewComment: "Commentaire de revision",
      requestedBy: "Demande par",
      reviewedBy: "Revise par",
      reviewedAt: "Revise le",
      createdAt: "Cree le"
    }
  }
};

const translateEventSource = (source: string, language: ReportLanguage | undefined): string => {
  const resolvedLanguage = resolveReportLanguage(language);
  return EVENT_SOURCE_LABELS[resolvedLanguage][source] ?? EVENT_SOURCE_LABELS.es[source] ?? source;
};

const translateEditRequestStatus = (status: string, language: ReportLanguage | undefined): string => {
  const resolvedLanguage = resolveReportLanguage(language);
  return EDIT_REQUEST_STATUS_LABELS[resolvedLanguage][status] ?? EDIT_REQUEST_STATUS_LABELS.es[status] ?? status;
};

const formatReportDateLabel = (date: Date, language: ReportLanguage): string => {
  return new Intl.DateTimeFormat(REPORT_LOCALE_BY_LANGUAGE[language], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
};

const formatReportDateTimeLabel = (date: Date, language: ReportLanguage): string => {
  return new Intl.DateTimeFormat(REPORT_LOCALE_BY_LANGUAGE[language], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const buildReportRangeLabel = (params: ReportParams, language: ReportLanguage): string => {
  if (!params.fromUtc || !params.toUtc) {
    return REPORT_TEXT[language].summary.noDateFilter;
  }

  return `${formatReportDateLabel(params.fromUtc, language)} - ${formatReportDateLabel(params.toUtc, language)}`;
};

const getExcelDateFormat = (language: ReportLanguage): string => {
  return language === "en" ? "mm/dd/yyyy" : "dd/mm/yyyy";
};

const getExcelDateTimeFormat = (language: ReportLanguage): string => {
  return `${getExcelDateFormat(language)} hh:mm`;
};

const toExcelDateTime = (value: string | null): Date | string => {
  return value ? new Date(value) : "";
};

const toExcelDateOnly = (value: string): Date => {
  return new Date(`${value}T12:00:00.000Z`);
};

const toExcelText = (value: string | null | undefined): string => {
  return value ?? "";
};

const EXCEL_HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF1F2937" }
};

const EXCEL_SUBTLE_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFF3F4F6" }
};

const EXCEL_ALTERNATE_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFF9FAFB" }
};

const EXCEL_BORDER = {
  top: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  left: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  bottom: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  right: { style: "thin" as const, color: { argb: "FFE5E7EB" } }
};

const EVENT_TYPE_BADGE_FILL: Record<WorkEventType, string> = {
  CLOCK_IN: "FFD1FAE5",
  BREAK_START: "FFFEF3C7",
  BREAK_END: "FFDBEAFE",
  CLOCK_OUT: "FFFCE7F3",
  MANUAL_ADJUSTMENT: "FFEDE9FE"
};

const EDIT_STATUS_BADGE_FILL: Record<string, string> = {
  PENDING: "FFFEF3C7",
  APPROVED: "FFD1FAE5",
  REJECTED: "FFFEE2E2"
};

const applyWorksheetHeaderStyle = (worksheet: ExcelJS.Worksheet, columnCount: number): void => {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 24;

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    const cell = headerRow.getCell(columnIndex);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = EXCEL_HEADER_FILL;
    cell.border = EXCEL_BORDER;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
};

const applyWorksheetBodyStyle = (
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  columnCount: number
): void => {
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const isAlternate = rowIndex % 2 === 0;

    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const cell = row.getCell(columnIndex);
      cell.border = EXCEL_BORDER;
      cell.alignment = { vertical: "top" };
      if (isAlternate) {
        cell.fill = EXCEL_ALTERNATE_FILL;
      }
    }
  }
};

const applyBadgeStyle = (
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumber: number,
  fillArgb: string
): void => {
  const cell = worksheet.getRow(rowNumber).getCell(columnNumber);
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb }
  };
  cell.font = { bold: true, color: { argb: "FF111827" } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
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

export const getSummaryReport = async (params: ReportParams): Promise<SummaryReportResult> => {
  const userWhere = await resolveReportUserWhere(params);

  const events = await prisma.workEvent.findMany({
    where: {
      ...(params.fromUtc && params.toUtc
        ? {
            eventAt: {
              gte: params.fromUtc,
              lte: params.toUtc
            }
          }
        : {}),
      ...userWhere
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

  const sortedRows = rows.sort((a, b) => {
    if (a.date === b.date) {
      return a.employee.localeCompare(b.employee);
    }
    return a.date.localeCompare(b.date);
  });

  const pageSize =
    params.pageSize === undefined ? sortedRows.length || 1 : Math.min(100, Math.max(1, params.pageSize));
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: sortedRows.slice(start, start + pageSize),
    total: sortedRows.length,
    page,
    pageSize
  };
};

const resolveReportUserWhere = async (params: ReportParams): Promise<Prisma.WorkEventWhereInput> => {
  if (params.userId) {
    await assertCanViewUser(params.requesterUserId, params.userId);
    return {
      userId: params.userId
    };
  }

  const requester = await getScopedUserById(params.requesterUserId);
  if (requester.role === "SUPERADMIN") {
    return {};
  }

  return {
    userId: {
      in: await listVisibleUserIds(params.requesterUserId)
    }
  };
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

export const getDetailedReportExport = async (params: ReportParams): Promise<DetailedReportExport> => {
  const language = resolveReportLanguage(params.language);
  const text = REPORT_TEXT[language];
  const requester = await getScopedUserById(params.requesterUserId);
  let userWhere: Prisma.WorkEventWhereInput = {};
  let scopeLabel = requester.fullName;

  if (params.userId) {
    const targetUser = await assertCanViewUser(params.requesterUserId, params.userId);
    userWhere = {
      userId: params.userId
    };
    scopeLabel = targetUser.fullName;
  } else if (requester.role === "SUPERADMIN") {
    scopeLabel = text.summary.allVisibleUsers;
  } else if (requester.role === "ADMIN") {
    userWhere = {
      userId: {
        in: await listVisibleUserIds(params.requesterUserId)
      }
    };
    scopeLabel = text.summary.adminTeamScope;
  } else {
    userWhere = {
      userId: requester.id
    };
  }

  const events = await prisma.workEvent.findMany({
    where: {
      ...(params.fromUtc && params.toUtc
        ? {
            eventAt: {
              gte: params.fromUtc,
              lte: params.toUtc
            }
          }
        : {}),
      ...userWhere
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      modifiedBy: {
        select: {
          fullName: true
        }
      },
      editRequests: {
        include: {
          requestedBy: {
            select: {
              fullName: true
            }
          },
          reviewedBy: {
            select: {
              fullName: true
            }
          }
        },
        orderBy: [{ createdAt: "asc" }]
      }
    },
    orderBy: [{ eventAt: "asc" }, { createdAt: "asc" }]
  });

  const eventRows: EventExportRow[] = events.map((event) => ({
    eventId: event.id,
    eventAt: event.eventAt.toISOString(),
    date: madridDateKey(event.eventAt),
    time: event.eventAt.toISOString(),
    userId: event.userId,
    employee: event.user.fullName,
    email: event.user.email,
    type: translateWorkEventType(event.type, language),
    typeCode: event.type,
    source: translateEventSource(event.source, language),
    sourceCode: event.source,
    note: event.note ?? "",
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    modifiedAt: event.modifiedAt ? event.modifiedAt.toISOString() : null,
    modifiedBy: event.modifiedBy?.fullName ?? null,
    modificationReason: event.modificationReason ?? null,
    createdAt: event.createdAt.toISOString()
  }));

  const editRequestRows: EditRequestExportRow[] = events.flatMap((event) =>
    event.editRequests.map((request) => ({
      requestId: request.id,
      eventId: event.id,
      employee: event.user.fullName,
      email: event.user.email,
      eventType: translateWorkEventType(event.type, language),
      eventTypeCode: event.type,
      originalEventAt: event.eventAt.toISOString(),
      requestedEventAt: request.requestedEventAt.toISOString(),
      requestedNote: request.requestedNote ?? null,
      reason: request.reason,
      status: translateEditRequestStatus(request.status, language),
      statusCode: request.status,
      reviewComment: request.reviewComment ?? null,
      requestedBy: request.requestedBy?.fullName ?? null,
      reviewedBy: request.reviewedBy?.fullName ?? null,
      reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
      createdAt: request.createdAt.toISOString()
    }))
  );

  return {
    meta: {
      language,
      generatedAt: new Date().toISOString(),
      scopeLabel,
      rangeLabel: buildReportRangeLabel(params, language),
      recordsCount: eventRows.length,
      rectificationsCount: editRequestRows.length,
      employeesCount: new Set(events.map((event) => event.userId)).size
    },
    events: eventRows,
    editRequests: editRequestRows
  };
};

export const detailedReportToExcelBuffer = async (report: DetailedReportExport): Promise<Buffer> => {
  const language = resolveReportLanguage(report.meta.language);
  const text = REPORT_TEXT[language];
  const dateFormat = getExcelDateFormat(language);
  const dateTimeFormat = getExcelDateTimeFormat(language);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Regismatic";
  workbook.created = new Date();
  workbook.modified = new Date();

  const eventsSheet = workbook.addWorksheet(text.sheets.events);
  eventsSheet.columns = [
    { header: text.eventColumns.eventId, key: "eventId", width: 28 },
    { header: text.eventColumns.eventAt, key: "eventAt", width: 20 },
    { header: text.eventColumns.date, key: "date", width: 14 },
    { header: text.eventColumns.time, key: "time", width: 10 },
    { header: text.eventColumns.employee, key: "employee", width: 26 },
    { header: text.eventColumns.email, key: "email", width: 30 },
    { header: text.eventColumns.type, key: "type", width: 18 },
    { header: text.eventColumns.source, key: "source", width: 14 },
    { header: text.eventColumns.note, key: "note", width: 36 },
    { header: text.eventColumns.latitude, key: "latitude", width: 12 },
    { header: text.eventColumns.longitude, key: "longitude", width: 12 },
    { header: text.eventColumns.modifiedAt, key: "modifiedAt", width: 20 },
    { header: text.eventColumns.modifiedBy, key: "modifiedBy", width: 22 },
    { header: text.eventColumns.modificationReason, key: "modificationReason", width: 34 },
    { header: text.eventColumns.createdAt, key: "createdAt", width: 20 }
  ];

  for (const row of report.events) {
    const excelRow = eventsSheet.addRow({
      eventId: row.eventId,
      eventAt: toExcelDateTime(row.eventAt),
      date: toExcelDateOnly(row.date),
      time: toExcelDateTime(row.time),
      employee: row.employee,
      email: row.email,
      type: row.type,
      source: row.source,
      note: row.note,
      latitude: row.latitude ?? "",
      longitude: row.longitude ?? "",
      modifiedAt: toExcelDateTime(row.modifiedAt),
      modifiedBy: toExcelText(row.modifiedBy),
      modificationReason: toExcelText(row.modificationReason),
      createdAt: toExcelDateTime(row.createdAt)
    });

    excelRow.getCell(10).numFmt = "0.000000";
    excelRow.getCell(11).numFmt = "0.000000";
  }

  applyWorksheetHeaderStyle(eventsSheet, 15);
  applyWorksheetBodyStyle(eventsSheet, 2, report.events.length + 1, 15);
  eventsSheet.getColumn(2).numFmt = dateTimeFormat;
  eventsSheet.getColumn(3).numFmt = dateFormat;
  eventsSheet.getColumn(4).numFmt = "hh:mm";
  eventsSheet.getColumn(12).numFmt = dateTimeFormat;
  eventsSheet.getColumn(15).numFmt = dateTimeFormat;
  eventsSheet.getColumn(9).alignment = { wrapText: true, vertical: "top" };
  eventsSheet.getColumn(14).alignment = { wrapText: true, vertical: "top" };
  eventsSheet.views = [{ state: "frozen", ySplit: 1 }];
  eventsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 15 }
  };

  report.events.forEach((row, index) => {
    applyBadgeStyle(eventsSheet, index + 2, 7, EVENT_TYPE_BADGE_FILL[row.typeCode] ?? "FFE5E7EB");
  });

  const editRequestsSheet = workbook.addWorksheet(text.sheets.editRequests);
  editRequestsSheet.columns = [
    { header: text.editColumns.requestId, key: "requestId", width: 28 },
    { header: text.editColumns.eventId, key: "eventId", width: 28 },
    { header: text.editColumns.employee, key: "employee", width: 26 },
    { header: text.editColumns.email, key: "email", width: 30 },
    { header: text.editColumns.eventType, key: "eventType", width: 18 },
    { header: text.editColumns.originalEventAt, key: "originalEventAt", width: 20 },
    { header: text.editColumns.requestedEventAt, key: "requestedEventAt", width: 20 },
    { header: text.editColumns.requestedNote, key: "requestedNote", width: 32 },
    { header: text.editColumns.reason, key: "reason", width: 34 },
    { header: text.editColumns.status, key: "status", width: 16 },
    { header: text.editColumns.reviewComment, key: "reviewComment", width: 34 },
    { header: text.editColumns.requestedBy, key: "requestedBy", width: 22 },
    { header: text.editColumns.reviewedBy, key: "reviewedBy", width: 22 },
    { header: text.editColumns.reviewedAt, key: "reviewedAt", width: 20 },
    { header: text.editColumns.createdAt, key: "createdAt", width: 20 }
  ];

  for (const row of report.editRequests) {
    editRequestsSheet.addRow({
      requestId: row.requestId,
      eventId: row.eventId,
      employee: row.employee,
      email: row.email,
      eventType: row.eventType,
      originalEventAt: toExcelDateTime(row.originalEventAt),
      requestedEventAt: toExcelDateTime(row.requestedEventAt),
      requestedNote: toExcelText(row.requestedNote),
      reason: row.reason,
      status: row.status,
      reviewComment: toExcelText(row.reviewComment),
      requestedBy: toExcelText(row.requestedBy),
      reviewedBy: toExcelText(row.reviewedBy),
      reviewedAt: toExcelDateTime(row.reviewedAt),
      createdAt: toExcelDateTime(row.createdAt)
    });
  }

  applyWorksheetHeaderStyle(editRequestsSheet, 15);
  applyWorksheetBodyStyle(editRequestsSheet, 2, report.editRequests.length + 1, 15);
  editRequestsSheet.getColumn(6).numFmt = dateTimeFormat;
  editRequestsSheet.getColumn(7).numFmt = dateTimeFormat;
  editRequestsSheet.getColumn(14).numFmt = dateTimeFormat;
  editRequestsSheet.getColumn(15).numFmt = dateTimeFormat;
  editRequestsSheet.getColumn(8).alignment = { wrapText: true, vertical: "top" };
  editRequestsSheet.getColumn(9).alignment = { wrapText: true, vertical: "top" };
  editRequestsSheet.getColumn(11).alignment = { wrapText: true, vertical: "top" };
  editRequestsSheet.views = [{ state: "frozen", ySplit: 1 }];
  editRequestsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 15 }
  };

  report.editRequests.forEach((row, index) => {
    applyBadgeStyle(editRequestsSheet, index + 2, 5, EVENT_TYPE_BADGE_FILL[row.eventTypeCode] ?? "FFE5E7EB");
    applyBadgeStyle(editRequestsSheet, index + 2, 10, EDIT_STATUS_BADGE_FILL[row.statusCode] ?? "FFE5E7EB");
  });

  const infoSheet = workbook.addWorksheet(text.sheets.guide);
  infoSheet.columns = [
    { width: 28 },
    { width: 92 }
  ];
  infoSheet.mergeCells("A1:B1");
  infoSheet.mergeCells("A3:B3");
  infoSheet.getCell("A1").value = text.summary.title;
  infoSheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF111827" } };
  infoSheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  infoSheet.getCell("A3").value = text.summary.guideTitle;
  infoSheet.getCell("A3").font = { bold: true, color: { argb: "FFFFFFFF" } };
  infoSheet.getCell("A3").fill = EXCEL_HEADER_FILL;
  infoSheet.getCell("A3").border = EXCEL_BORDER;
  infoSheet.getCell("A3").alignment = { vertical: "middle", horizontal: "left" };

  text.guide.forEach((line, index) => {
    const rowNumber = 4 + index;
    infoSheet.mergeCells(`A${rowNumber}:B${rowNumber}`);
    const cell = infoSheet.getCell(`A${rowNumber}`);
    cell.value = line;
    cell.border = EXCEL_BORDER;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (index % 2 === 0) {
      cell.fill = EXCEL_ALTERNATE_FILL;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};


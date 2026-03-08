import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import { getSummaryReport, summaryToCsv, summaryToExcelBuffer } from "../services/report.service";
import { parseReportRange } from "../utils/report-range";

const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().optional()
});

const getReportRows = async (req: Request) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const query = reportQuerySchema.parse(req.query);
  const range = parseReportRange(query.from, query.to);

  return getSummaryReport({
    fromUtc: range.fromUtc,
    toUtc: range.toUtc,
    requesterRole: req.user.role,
    requesterUserId: req.user.id,
    userId: query.userId
  });
};

export const summaryReportController = async (req: Request, res: Response) => {
  const rows = await getReportRows(req);
  return res.json({ rows });
};

export const csvReportController = async (req: Request, res: Response) => {
  const rows = await getReportRows(req);
  const csv = summaryToCsv(rows);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=regismatic-report.csv");
  return res.send(csv);
};

export const excelReportController = async (req: Request, res: Response) => {
  const rows = await getReportRows(req);
  const workbook = await summaryToExcelBuffer(rows);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=regismatic-report.xlsx");
  return res.send(workbook);
};

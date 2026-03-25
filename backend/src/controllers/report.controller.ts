import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import { detailedReportToExcelBuffer, getDetailedReportExport, getSummaryReport, summaryToCsv } from "../services/report.service";
import { assertNonBillingFeatureAccessForUser } from "../services/billing.service";
import { parseReportRange } from "../utils/report-range";
import { strictObject } from "../utils/validation";

const reportQuerySchema = strictObject({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

const getParsedReportQuery = async (req: Request) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const query = reportQuerySchema.parse(req.query);
  const range = parseReportRange(query.from, query.to);

  return {
    requesterRole: req.user.role,
    requesterUserId: req.user.id,
    userId: query.userId,
    fromUtc: range.fromUtc,
    toUtc: range.toUtc,
    page: query.page,
    pageSize: query.pageSize
  };
};

const getReportRows = async (req: Request) => {
  return getSummaryReport(await getParsedReportQuery(req));
};

export const summaryReportController = async (req: Request, res: Response) => {
  const report = await getReportRows(req);
  return res.json(report);
};

export const csvReportController = async (req: Request, res: Response) => {
  const query = await getParsedReportQuery(req);
  const report = await getSummaryReport({
    ...query,
    page: 1,
    pageSize: undefined
  });
  const csv = summaryToCsv(report.rows);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=regismatic-report.csv");
  return res.send(csv);
};

export const excelReportController = async (req: Request, res: Response) => {
  const query = await getParsedReportQuery(req);
  const report = await getDetailedReportExport(query);
  const workbook = await detailedReportToExcelBuffer(report);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=regismatic-report.xlsx");
  return res.send(workbook);
};

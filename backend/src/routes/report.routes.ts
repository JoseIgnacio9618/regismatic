import { Router } from "express";
import { csvReportController, excelReportController, summaryReportController } from "../controllers/report.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const reportRouter = Router();

reportRouter.use(authMiddleware);
reportRouter.get("/summary", asyncHandler(summaryReportController));
reportRouter.get("/summary.xlsx", asyncHandler(excelReportController));
reportRouter.get("/summary.csv", asyncHandler(csvReportController));

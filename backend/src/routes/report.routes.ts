import { Router } from "express";
import { csvReportController, summaryReportController } from "../controllers/report.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const reportRouter = Router();

reportRouter.use(authMiddleware);
reportRouter.get("/summary", asyncHandler(summaryReportController));
reportRouter.get("/summary.csv", asyncHandler(csvReportController));

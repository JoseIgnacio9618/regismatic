import express, { Router } from "express";
import {
  adminSeatLimitControlsController,
  billingPaymentsHistoryController,
  billingOverviewController,
  clearAdminCustomSeatLimitController,
  createBillingPortalSessionController,
  createCheckoutSessionController,
  setAdminCustomSeatLimitController,
  stripeWebhookController
} from "../controllers/billing.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const billingWebhookRouter = Router();
billingWebhookRouter.post("/webhook", express.raw({ type: "application/json" }), asyncHandler(stripeWebhookController));

export const billingRouter = Router();

billingRouter.use(authMiddleware);
billingRouter.get("/overview", asyncHandler(billingOverviewController));
billingRouter.get("/admin-seat-limits", asyncHandler(adminSeatLimitControlsController));
billingRouter.get("/payments-history", asyncHandler(billingPaymentsHistoryController));
billingRouter.post("/checkout-session", asyncHandler(createCheckoutSessionController));
billingRouter.post("/portal-session", asyncHandler(createBillingPortalSessionController));
billingRouter.patch("/admins/:adminId/custom-seat-limit", asyncHandler(setAdminCustomSeatLimitController));
billingRouter.delete("/admins/:adminId/custom-seat-limit", asyncHandler(clearAdminCustomSeatLimitController));

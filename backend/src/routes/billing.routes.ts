import express, { Router } from "express";
import {
  billingPaymentsHistoryController,
  billingOverviewController,
  createBillingPortalSessionController,
  createCheckoutSessionController,
  stripeWebhookController
} from "../controllers/billing.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const billingWebhookRouter = Router();
billingWebhookRouter.post("/webhook", express.raw({ type: "application/json" }), asyncHandler(stripeWebhookController));

export const billingRouter = Router();

billingRouter.use(authMiddleware);
billingRouter.get("/overview", asyncHandler(billingOverviewController));
billingRouter.get("/payments-history", asyncHandler(billingPaymentsHistoryController));
billingRouter.post("/checkout-session", asyncHandler(createCheckoutSessionController));
billingRouter.post("/portal-session", asyncHandler(createBillingPortalSessionController));

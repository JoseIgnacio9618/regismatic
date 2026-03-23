import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import {
  createBillingPortalSessionForAdmin,
  createCheckoutSessionForAdmin,
  getBillingPaymentsHistoryForUser,
  getBillingOverviewForUser,
  handleStripeWebhook
} from "../services/billing.service";

const checkoutSchema = z.object({
  priceId: z.string().trim().min(1)
});

export const billingOverviewController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const overview = await getBillingOverviewForUser(req.user.id);
  return res.json(overview);
};

export const createCheckoutSessionController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = checkoutSchema.parse(req.body);
  const session = await createCheckoutSessionForAdmin({
    requesterId: req.user.id,
    priceId: payload.priceId
  });

  return res.status(201).json(session);
};

export const createBillingPortalSessionController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const session = await createBillingPortalSessionForAdmin(req.user.id);
  return res.status(201).json(session);
};

export const billingPaymentsHistoryController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const history = await getBillingPaymentsHistoryForUser(req.user.id);
  return res.json(history);
};

export const stripeWebhookController = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  const header = Array.isArray(signature) ? signature[0] : signature;
  const eventType = await handleStripeWebhook(req.body as Buffer, header);
  return res.json({ received: true, eventType });
};

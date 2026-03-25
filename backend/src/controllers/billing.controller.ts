import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import {
  assertNonBillingFeatureAccessForUser,
  clearAdminCustomSeatLimit,
  createBillingPortalSessionForAdmin,
  createCheckoutSessionForAdmin,
  getBillingPaymentsHistoryForUser,
  listAdminSeatLimitControls,
  getBillingOverviewForUser,
  setAdminCustomSeatLimit,
  handleStripeWebhook
} from "../services/billing.service";
import { strictObject } from "../utils/validation";

const checkoutSchema = strictObject({
  priceId: z.string().trim().min(1)
});

const customSeatLimitSchema = strictObject({
  seatLimit: z.number().int().min(1).max(5000)
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

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const history = await getBillingPaymentsHistoryForUser(req.user.id);
  return res.json(history);
};

export const adminSeatLimitControlsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const controls = await listAdminSeatLimitControls(req.user.id);
  return res.json({ admins: controls });
};

export const setAdminCustomSeatLimitController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = customSeatLimitSchema.parse(req.body);
  const adminId = Array.isArray(req.params.adminId) ? req.params.adminId[0] : req.params.adminId;
  const admin = await setAdminCustomSeatLimit({
    requesterId: req.user.id,
    adminId,
    seatLimit: payload.seatLimit
  });

  return res.json(admin);
};

export const clearAdminCustomSeatLimitController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const adminId = Array.isArray(req.params.adminId) ? req.params.adminId[0] : req.params.adminId;
  const admin = await clearAdminCustomSeatLimit({
    requesterId: req.user.id,
    adminId
  });

  return res.json(admin);
};

export const stripeWebhookController = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  const header = Array.isArray(signature) ? signature[0] : signature;
  const eventType = await handleStripeWebhook(req.body as Buffer, header);
  return res.json({ received: true, eventType });
};

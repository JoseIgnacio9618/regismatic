import {
  BillingPlanCode,
  BillingSubscriptionStatus,
  Prisma,
  type Role
} from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../middlewares/error.middleware";
import { getScopedUserById } from "./access.service";

type BillingPlanDefinition = {
  code: BillingPlanCode;
  name: string;
  monthlyPriceEur: number;
  seatLimit: number;
  stripePriceId?: string;
  isDemo?: boolean;
};

const STRIPE_ENABLED = Boolean(env.STRIPE_SECRET_KEY);

const stripe = STRIPE_ENABLED ? new Stripe(env.STRIPE_SECRET_KEY as string) : null;

const BILLING_SUBSCRIPTION_SELECT = {
  id: true,
  adminId: true,
  planCode: true,
  status: true,
  seatLimit: true,
  isTrial: true,
  trialEndsAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripePriceId: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BillingSubscriptionSelect;

type BillingSubscriptionRecord = Prisma.BillingSubscriptionGetPayload<{ select: typeof BILLING_SUBSCRIPTION_SELECT }>;

export type BillingPlanView = {
  code: BillingPlanCode;
  name: string;
  monthlyPriceEur: number;
  seatLimit: number;
  isDemo: boolean;
  checkoutEnabled: boolean;
};

export type BillingSummary = {
  isBypassed: boolean;
  stripeConfigured: boolean;
  plan: BillingPlanView;
  status: BillingSubscriptionStatus | "BYPASSED";
  seatUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  managementUrls: {
    checkoutAvailable: boolean;
    portalAvailable: boolean;
  };
};

const BILLING_PLANS: Record<BillingPlanCode, BillingPlanDefinition> = {
  DEMO_10: {
    code: "DEMO_10",
    name: "Demo 10",
    monthlyPriceEur: 0,
    seatLimit: env.BILLING_TRIAL_SEAT_LIMIT,
    isDemo: true
  },
  PACK_10: {
    code: "PACK_10",
    name: "Pack 10",
    monthlyPriceEur: 19,
    seatLimit: 10,
    stripePriceId: env.STRIPE_PRICE_PACK_10_MONTHLY
  },
  PACK_20: {
    code: "PACK_20",
    name: "Pack 20",
    monthlyPriceEur: 29,
    seatLimit: 20,
    stripePriceId: env.STRIPE_PRICE_PACK_20_MONTHLY
  },
  PACK_50: {
    code: "PACK_50",
    name: "Pack 50",
    monthlyPriceEur: 59,
    seatLimit: 50,
    stripePriceId: env.STRIPE_PRICE_PACK_50_MONTHLY
  },
  PACK_100: {
    code: "PACK_100",
    name: "Pack 100",
    monthlyPriceEur: 99,
    seatLimit: 100,
    stripePriceId: env.STRIPE_PRICE_PACK_100_MONTHLY
  }
};

const ACTIVE_BILLING_STATUSES = new Set<BillingSubscriptionStatus>(["TRIALING", "ACTIVE"]);

const normalizeDate = (value: Date | null | undefined): string | null => value?.toISOString() ?? null;

const toPlanView = (plan: BillingPlanDefinition): BillingPlanView => ({
  code: plan.code,
  name: plan.name,
  monthlyPriceEur: plan.monthlyPriceEur,
  seatLimit: plan.seatLimit,
  isDemo: Boolean(plan.isDemo),
  checkoutEnabled: !plan.isDemo && STRIPE_ENABLED && Boolean(plan.stripePriceId)
});

const getCheckoutPlan = (planCode: BillingPlanCode): BillingPlanDefinition => {
  const plan = BILLING_PLANS[planCode];
  if (!plan || plan.isDemo) {
    throw new AppError("Selected billing plan is not available for checkout.", 400);
  }

  if (!plan.stripePriceId) {
    throw new AppError("Stripe billing is not fully configured.", 503);
  }

  return plan;
};

const ensureStripeReady = (): Stripe => {
  if (!stripe || !env.STRIPE_CHECKOUT_SUCCESS_URL || !env.STRIPE_CHECKOUT_CANCEL_URL || !env.STRIPE_BILLING_PORTAL_RETURN_URL) {
    throw new AppError("Stripe billing is not fully configured.", 503);
  }

  return stripe;
};

const getPlanByPriceId = (priceId: string | null | undefined): BillingPlanDefinition | null => {
  if (!priceId) {
    return null;
  }

  return Object.values(BILLING_PLANS).find((plan) => plan.stripePriceId === priceId) ?? null;
};

const mapStripeStatus = (status: Stripe.Subscription.Status): BillingSubscriptionStatus => {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAST_DUE";
    default:
      return "PAST_DUE";
  }
};

const getManagedEmployeesCount = async (adminId: string): Promise<number> => {
  return prisma.user.count({
    where: {
      role: "EMPLOYEE",
      managerId: adminId
    }
  });
};

const createDefaultTrialSubscription = async (adminId: string): Promise<BillingSubscriptionRecord> => {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + env.BILLING_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  return prisma.billingSubscription.create({
    data: {
      adminId,
      planCode: "DEMO_10",
      status: "TRIALING",
      seatLimit: env.BILLING_TRIAL_SEAT_LIMIT,
      isTrial: true,
      trialEndsAt
    },
    select: BILLING_SUBSCRIPTION_SELECT
  });
};

const loadOrCreateAdminSubscription = async (adminId: string): Promise<BillingSubscriptionRecord> => {
  const existing = await prisma.billingSubscription.findUnique({
    where: { adminId },
    select: BILLING_SUBSCRIPTION_SELECT
  });

  if (existing) {
    return existing;
  }

  return createDefaultTrialSubscription(adminId);
};

const getAdminSubscriptionForUpdate = async (adminId: string): Promise<BillingSubscriptionRecord | null> => {
  return prisma.billingSubscription.findUnique({
    where: { adminId },
    select: BILLING_SUBSCRIPTION_SELECT
  });
};

const isTrialExpired = (subscription: BillingSubscriptionRecord): boolean => {
  return Boolean(subscription.isTrial && subscription.trialEndsAt && subscription.trialEndsAt.getTime() < Date.now());
};

const isSubscriptionUsable = (subscription: BillingSubscriptionRecord): boolean => {
  if (!ACTIVE_BILLING_STATUSES.has(subscription.status)) {
    return false;
  }

  if (subscription.isTrial && isTrialExpired(subscription)) {
    return false;
  }

  return true;
};

const buildBillingSummary = async (
  role: Role,
  subscription: BillingSubscriptionRecord | null,
  userId: string
): Promise<BillingSummary | null> => {
  if (role === "EMPLOYEE") {
    return null;
  }

  if (role === "SUPERADMIN") {
    const plan = toPlanView(BILLING_PLANS.PACK_100);
    return {
      isBypassed: true,
      stripeConfigured: STRIPE_ENABLED,
      plan,
      status: "BYPASSED",
      seatUsage: {
        used: 0,
        limit: plan.seatLimit,
        remaining: plan.seatLimit
      },
      isTrial: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      managementUrls: {
        checkoutAvailable: false,
        portalAvailable: false
      }
    };
  }

  const ensuredSubscription = subscription ?? (await loadOrCreateAdminSubscription(userId));
  const plan = toPlanView(BILLING_PLANS[ensuredSubscription.planCode]);
  const used = await getManagedEmployeesCount(userId);
  const remaining = Math.max(0, ensuredSubscription.seatLimit - used);

  return {
    isBypassed: false,
    stripeConfigured: STRIPE_ENABLED,
    plan,
    status: ensuredSubscription.status,
    seatUsage: {
      used,
      limit: ensuredSubscription.seatLimit,
      remaining
    },
    isTrial: ensuredSubscription.isTrial,
    trialEndsAt: normalizeDate(ensuredSubscription.trialEndsAt),
    currentPeriodEnd: normalizeDate(ensuredSubscription.currentPeriodEnd),
    cancelAtPeriodEnd: ensuredSubscription.cancelAtPeriodEnd,
    managementUrls: {
      checkoutAvailable: STRIPE_ENABLED,
      portalAvailable: STRIPE_ENABLED && Boolean(ensuredSubscription.stripeCustomerId)
    }
  };
};

const ensureDemoIpAvailability = async (adminId: string, ipAddress: string | null): Promise<void> => {
  if (env.BILLING_TRIAL_IP_ENFORCEMENT !== "true" || !ipAddress) {
    return;
  }

  const existing = await prisma.adminTrialIpClaim.findUnique({
    where: { ipAddress },
    select: {
      adminId: true
    }
  });

  if (existing && existing.adminId !== adminId) {
    throw new AppError("A demo admin account was already created from this IP address.", 409);
  }
};

const upsertDemoIpClaim = async (adminId: string, ipAddress: string | null): Promise<void> => {
  if (env.BILLING_TRIAL_IP_ENFORCEMENT !== "true" || !ipAddress) {
    return;
  }

  await prisma.adminTrialIpClaim.upsert({
    where: { adminId },
    update: { ipAddress },
    create: { adminId, ipAddress }
  });
};

const resolveStripeCustomerId = async (
  stripeClient: Stripe,
  admin: { id: string; email: string; fullName: string },
  subscription: BillingSubscriptionRecord
): Promise<string> => {
  if (subscription.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  const customer = await stripeClient.customers.create({
    email: admin.email,
    name: admin.fullName,
    metadata: {
      adminId: admin.id
    }
  });

  await prisma.billingSubscription.update({
    where: { adminId: admin.id },
    data: {
      stripeCustomerId: customer.id
    }
  });

  return customer.id;
};

export const listBillingPlans = (): BillingPlanView[] => {
  return [
    toPlanView(BILLING_PLANS.DEMO_10),
    toPlanView(BILLING_PLANS.PACK_10),
    toPlanView(BILLING_PLANS.PACK_20),
    toPlanView(BILLING_PLANS.PACK_50),
    toPlanView(BILLING_PLANS.PACK_100)
  ];
};

export const ensureAdminBillingProfile = async (params: { adminId: string; requestIp?: string | null; enforceIpClaim?: boolean }) => {
  const admin = await prisma.user.findUnique({
    where: { id: params.adminId },
    select: {
      id: true,
      role: true
    }
  });

  if (!admin) {
    throw new AppError("User not found.", 404);
  }

  if (admin.role !== "ADMIN") {
    return null;
  }

  if (params.enforceIpClaim) {
    await ensureDemoIpAvailability(admin.id, params.requestIp ?? null);
  }

  const subscription = await loadOrCreateAdminSubscription(admin.id);

  if (params.enforceIpClaim) {
    await upsertDemoIpClaim(admin.id, params.requestIp ?? null);
  }

  return subscription;
};

export const getBillingOverviewForUser = async (requesterId: string): Promise<{ plans: BillingPlanView[]; summary: BillingSummary | null }> => {
  const requester = await getScopedUserById(requesterId);
  const summary = await buildBillingSummary(requester.role, requester.role === "ADMIN" ? await loadOrCreateAdminSubscription(requester.id) : null, requester.id);

  return {
    plans: listBillingPlans(),
    summary
  };
};

export const assertAdminSeatAvailability = async (params: { adminId: string; requesterRole?: Role }) => {
  if (params.requesterRole === "SUPERADMIN") {
    return;
  }

  const admin = await prisma.user.findUnique({
    where: { id: params.adminId },
    select: {
      id: true,
      role: true,
      isActive: true
    }
  });

  if (!admin || !admin.isActive) {
    throw new AppError("User not found.", 404);
  }

  if (admin.role !== "ADMIN") {
    throw new AppError("Selected manager is not a valid administrator.", 400);
  }

  const subscription = await loadOrCreateAdminSubscription(admin.id);
  if (!isSubscriptionUsable(subscription)) {
    throw new AppError("Your billing plan is not active. Upgrade or renew it before adding more employees.", 403);
  }

  const usedSeats = await getManagedEmployeesCount(admin.id);
  if (usedSeats >= subscription.seatLimit) {
    throw new AppError("Your current billing plan does not allow more employees.", 409);
  }
};

export const createCheckoutSessionForAdmin = async (params: { requesterId: string; planCode: BillingPlanCode }) => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "ADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const stripeClient = ensureStripeReady();
  const plan = getCheckoutPlan(params.planCode);
  const subscription = await loadOrCreateAdminSubscription(requester.id);
  const customerId = await resolveStripeCustomerId(
    stripeClient,
    {
      id: requester.id,
      email: requester.email,
      fullName: requester.fullName
    },
    subscription
  );

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    success_url: env.STRIPE_CHECKOUT_SUCCESS_URL as string,
    cancel_url: env.STRIPE_CHECKOUT_CANCEL_URL as string,
    client_reference_id: requester.id,
    allow_promotion_codes: true,
    line_items: [
      {
        price: plan.stripePriceId as string,
        quantity: 1
      }
    ],
    metadata: {
      adminId: requester.id,
      planCode: params.planCode
    },
    subscription_data: {
      metadata: {
        adminId: requester.id,
        planCode: params.planCode
      }
    }
  });

  await prisma.billingSubscription.update({
    where: { adminId: requester.id },
    data: {
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id
    }
  });

  if (!session.url) {
    throw new AppError("Could not create Stripe checkout session.", 502);
  }

  return {
    url: session.url
  };
};

export const createBillingPortalSessionForAdmin = async (requesterId: string) => {
  const requester = await getScopedUserById(requesterId);
  if (requester.role !== "ADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const stripeClient = ensureStripeReady();
  const subscription = await loadOrCreateAdminSubscription(requester.id);
  if (!subscription.stripeCustomerId) {
    throw new AppError("No Stripe customer is linked to this administrator yet.", 409);
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: env.STRIPE_BILLING_PORTAL_RETURN_URL as string
  });

  return {
    url: session.url
  };
};

const syncBillingSubscriptionFromStripe = async (stripeSubscriptionId: string) => {
  const stripeClient = ensureStripeReady();
  const subscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const subscriptionItem = subscription.items.data[0];
  const mappedPlan = getPlanByPriceId(subscriptionItem?.price?.id);
  const periodData = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  if (!mappedPlan || mappedPlan.isDemo) {
    throw new AppError("Stripe subscription price is not mapped to a Regismatic plan.", 400);
  }

  const metadataAdminId = subscription.metadata?.adminId;
  const existing =
    (await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      select: BILLING_SUBSCRIPTION_SELECT
    })) ??
    (await prisma.billingSubscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: BILLING_SUBSCRIPTION_SELECT
    })) ??
    (metadataAdminId
      ? await prisma.billingSubscription.findUnique({
          where: { adminId: metadataAdminId },
          select: BILLING_SUBSCRIPTION_SELECT
        })
      : null);

  if (!existing) {
    throw new AppError("No billing profile matched the Stripe subscription.", 404);
  }

  await prisma.billingSubscription.update({
    where: { adminId: existing.adminId },
    data: {
      planCode: mappedPlan.code,
      status: mapStripeStatus(subscription.status),
      seatLimit: mappedPlan.seatLimit,
      isTrial: false,
      trialEndsAt: null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscriptionItem.price.id,
      currentPeriodStart: periodData.current_period_start ? new Date(periodData.current_period_start * 1000) : null,
      currentPeriodEnd: periodData.current_period_end ? new Date(periodData.current_period_end * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
  });
};

export const handleStripeWebhook = async (rawBody: Buffer, signature: string | undefined) => {
  const stripeClient = ensureStripeReady();
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError("Stripe billing is not fully configured.", 503);
  }

  const event = stripeClient.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        await syncBillingSubscriptionFromStripe(session.subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncBillingSubscriptionFromStripe(subscription.id);
      break;
    }
    default:
      break;
  }

  return event.type;
};

export const getBillingSnapshotForAuth = async (userId: string, role: Role) => {
  if (role === "EMPLOYEE") {
    return null;
  }

  const subscription = role === "ADMIN" ? await loadOrCreateAdminSubscription(userId) : null;
  return buildBillingSummary(role, subscription, userId);
};

export const getAdminSeatUsage = async (adminId: string): Promise<{ used: number; limit: number }> => {
  const subscription = await loadOrCreateAdminSubscription(adminId);
  const used = await getManagedEmployeesCount(adminId);
  return {
    used,
    limit: subscription.seatLimit
  };
};

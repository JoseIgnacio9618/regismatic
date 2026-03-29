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
import { createNotificationsForUsers } from "./notification.service";

type BillingInterval = "month" | "year";

type BillingPlanDefinition = {
  code: BillingPlanCode;
  defaultName: string;
  seatLimit: number;
  isDemo?: boolean;
};

type BillingPriceConfig = {
  planCode: Exclude<BillingPlanCode, "DEMO_10">;
  interval: BillingInterval;
  priceId?: string;
};

type StripeCatalogPrice = {
  priceId: string;
  planCode: Exclude<BillingPlanCode, "DEMO_10">;
  interval: BillingInterval;
  amountEur: number | null;
  currency: string | null;
  productName: string | null;
  active: boolean;
};

const STRIPE_ENABLED = Boolean(env.STRIPE_SECRET_KEY);

const stripe = STRIPE_ENABLED ? new Stripe(env.STRIPE_SECRET_KEY as string) : null;

const BILLING_SUBSCRIPTION_SELECT = {
  id: true,
  adminId: true,
  planCode: true,
  status: true,
  seatLimit: true,
  customSeatLimit: true,
  customSeatLimitUpdatedAt: true,
  customSeatLimitUpdatedById: true,
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

export type BillingPriceView = {
  interval: BillingInterval;
  priceId: string | null;
  amountEur: number | null;
  currency: string | null;
  pricePerSeatEur: number | null;
  monthlyEquivalentEur: number | null;
  savingsVsMonthlyPercent: number | null;
  checkoutEnabled: boolean;
};

export type BillingPlanView = {
  code: BillingPlanCode;
  name: string;
  seatLimit: number;
  isDemo: boolean;
  checkoutEnabled: boolean;
  pricingOptions: BillingPriceView[];
};

export type BillingSummary = {
  isBypassed: boolean;
  stripeConfigured: boolean;
  plan: BillingPlanView;
  currentPrice: BillingPriceView | null;
  status: BillingSubscriptionStatus | "BYPASSED";
  seatLimitSource: "BYPASSED" | "SUBSCRIPTION" | "CUSTOM";
  seatUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
  customSeatLimit: number | null;
  customSeatLimitUpdatedAt: string | null;
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  managementUrls: {
    checkoutAvailable: boolean;
    portalAvailable: boolean;
  };
};

export type BillingPaymentRecord = {
  invoiceId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currency: string | null;
  amountDueEur: number | null;
  amountPaidEur: number | null;
  amountRemainingEur: number | null;
  createdAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
};

export type BillingAccountPaymentsView = {
  admin: {
    id: string;
    email: string;
    fullName: string;
  };
  subscription: {
    planCode: BillingPlanCode;
    status: BillingSubscriptionStatus;
    seatLimit: number;
    isTrial: boolean;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  };
  paymentStats: {
    paidInvoicesCount: number;
    totalPaidEur: number;
    lastPaymentAt: string | null;
  };
  payments: BillingPaymentRecord[];
};

export type BillingPaymentsHistoryResponse = {
  scope: "ADMIN" | "SUPERADMIN";
  stripeConfigured: boolean;
  accounts: BillingAccountPaymentsView[];
  total: number;
  page: number;
  pageSize: number;
};

export type AttendanceAccessSummary = {
  canRecordAttendance: boolean;
  reason: "OK" | "TEAM_ASSIGNMENT_REQUIRED" | "BILLING_INACTIVE" | "NOT_APPLICABLE";
  managedByAdminId: string | null;
  managedByAdminName: string | null;
  requiresSubscriptionAction: boolean;
  dataDeletionAt: string | null;
};

export type AdminSeatLimitControlView = {
  admin: {
    id: string;
    email: string;
    fullName: string;
  };
  billing: {
    planCode: BillingPlanCode;
    status: BillingSubscriptionStatus;
    seatLimitSource: "SUBSCRIPTION" | "CUSTOM";
    subscriptionSeatLimit: number;
    effectiveSeatLimit: number;
    customSeatLimit: number | null;
    customSeatLimitUpdatedAt: string | null;
    isTrial: boolean;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    currentPrice: BillingPriceView | null;
  };
  seatUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
};

export type AdminSeatLimitControlsStats = {
  totalAdmins: number;
  totalManagedSeatsUsed: number;
  totalManagedSeatsLimit: number;
  totalManualOverrides: number;
  totalAttentionAdmins: number;
};

export type PaginatedAdminSeatLimitControlsResult = {
  admins: AdminSeatLimitControlView[];
  total: number;
  page: number;
  pageSize: number;
  stats: AdminSeatLimitControlsStats;
};

type EffectiveSeatLimit = {
  source: "SUBSCRIPTION" | "CUSTOM";
  limit: number;
};

const ADMIN_SEAT_LIMIT_CONTROL_SELECT = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  billingSubscription: {
    select: BILLING_SUBSCRIPTION_SELECT
  }
} satisfies Prisma.UserSelect;

type AdminSeatLimitAdminRecord = Prisma.UserGetPayload<{ select: typeof ADMIN_SEAT_LIMIT_CONTROL_SELECT }>;

const BILLING_PLANS: Record<BillingPlanCode, BillingPlanDefinition> = {
  DEMO_10: {
    code: "DEMO_10",
    defaultName: "Demo 10",
    seatLimit: env.BILLING_TRIAL_SEAT_LIMIT,
    isDemo: true
  },
  PACK_10: {
    code: "PACK_10",
    defaultName: "Pack 10",
    seatLimit: 10
  },
  PACK_20: {
    code: "PACK_20",
    defaultName: "Pack 20",
    seatLimit: 20
  },
  PACK_50: {
    code: "PACK_50",
    defaultName: "Pack 50",
    seatLimit: 50
  },
  PACK_100: {
    code: "PACK_100",
    defaultName: "Pack 100",
    seatLimit: 100
  }
};

const STRIPE_PRICE_CONFIGS: BillingPriceConfig[] = [
  {
    planCode: "PACK_10",
    interval: "month",
    priceId: env.STRIPE_PRICE_PACK_10_MONTHLY
  },
  {
    planCode: "PACK_10",
    interval: "year",
    priceId: env.STRIPE_PRICE_PACK_10_YEARLY
  },
  {
    planCode: "PACK_20",
    interval: "month",
    priceId: env.STRIPE_PRICE_PACK_20_MONTHLY
  },
  {
    planCode: "PACK_20",
    interval: "year",
    priceId: env.STRIPE_PRICE_PACK_20_YEARLY
  },
  {
    planCode: "PACK_50",
    interval: "month",
    priceId: env.STRIPE_PRICE_PACK_50_MONTHLY
  },
  {
    planCode: "PACK_50",
    interval: "year",
    priceId: env.STRIPE_PRICE_PACK_50_YEARLY
  },
  {
    planCode: "PACK_100",
    interval: "month",
    priceId: env.STRIPE_PRICE_PACK_100_MONTHLY
  },
  {
    planCode: "PACK_100",
    interval: "year",
    priceId: env.STRIPE_PRICE_PACK_100_YEARLY
  }
];

const ACTIVE_BILLING_STATUSES = new Set<BillingSubscriptionStatus>(["TRIALING", "ACTIVE"]);

const normalizeDate = (value: Date | null | undefined): string | null => value?.toISOString() ?? null;

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const centsToEur = (value: number | null | undefined): number | null => {
  if (typeof value !== "number") {
    return null;
  }

  return roundMoney(value / 100);
};

const resolveExpandedProductName = (product: Stripe.Price["product"]): string | null => {
  if (!product || typeof product === "string") {
    return null;
  }

  if ("deleted" in product && product.deleted) {
    return null;
  }

  return product.name?.trim() || null;
};

const loadStripeCatalog = async (): Promise<Map<string, StripeCatalogPrice>> => {
  const catalog = new Map<string, StripeCatalogPrice>();
  if (!stripe) {
    return catalog;
  }

  const configuredPrices = STRIPE_PRICE_CONFIGS.filter((config) => Boolean(config.priceId?.trim()));
  if (configuredPrices.length === 0) {
    return catalog;
  }

  const results = await Promise.allSettled(
    configuredPrices.map(async (config) => {
      const price = await stripe.prices.retrieve(config.priceId as string, {
        expand: ["product"]
      });

      return {
        config,
        price
      };
    })
  );

  for (const result of results) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const {
      config,
      price
    } = result.value;

    catalog.set(price.id, {
      priceId: price.id,
      planCode: config.planCode,
      interval: config.interval,
      amountEur: price.unit_amount === null ? null : roundMoney(price.unit_amount / 100),
      currency: price.currency?.toUpperCase() ?? null,
      productName: resolveExpandedProductName(price.product),
      active: price.active
    });
  }

  return catalog;
};

const getPlanCatalogPrice = (
  catalog: Map<string, StripeCatalogPrice>,
  planCode: Exclude<BillingPlanCode, "DEMO_10">,
  interval: BillingInterval
): StripeCatalogPrice | null => {
  const config = STRIPE_PRICE_CONFIGS.find((item) => item.planCode === planCode && item.interval === interval);
  if (!config?.priceId) {
    return null;
  }

  return catalog.get(config.priceId) ?? null;
};

const toBillingPriceView = (
  plan: BillingPlanDefinition,
  interval: BillingInterval,
  price: StripeCatalogPrice | null,
  monthlyAmount: number | null
): BillingPriceView => {
  const amountEur = price?.amountEur ?? null;
  const monthlyEquivalentEur =
    amountEur === null
      ? null
      : interval === "year"
        ? roundMoney(amountEur / 12)
        : amountEur;

  const savingsVsMonthlyPercent =
    interval === "year" && monthlyAmount !== null && monthlyAmount > 0 && monthlyEquivalentEur !== null
      ? Math.max(0, Math.round((1 - monthlyEquivalentEur / monthlyAmount) * 100))
      : null;

  return {
    interval,
    priceId: price?.priceId ?? null,
    amountEur,
    currency: price?.currency ?? "EUR",
    pricePerSeatEur: amountEur === null ? null : roundMoney(amountEur / plan.seatLimit),
    monthlyEquivalentEur,
    savingsVsMonthlyPercent,
    checkoutEnabled: Boolean(price?.active && price.priceId)
  };
};

const buildPlanView = (plan: BillingPlanDefinition, catalog: Map<string, StripeCatalogPrice>): BillingPlanView => {
  if (plan.isDemo) {
    return {
      code: plan.code,
      name: plan.defaultName,
      seatLimit: plan.seatLimit,
      isDemo: true,
      checkoutEnabled: false,
      pricingOptions: []
    };
  }

  const paidPlanCode = plan.code as Exclude<BillingPlanCode, "DEMO_10">;
  const monthlyPrice = getPlanCatalogPrice(catalog, paidPlanCode, "month");
  const yearlyPrice = getPlanCatalogPrice(catalog, paidPlanCode, "year");
  const monthlyView = toBillingPriceView(plan, "month", monthlyPrice, monthlyPrice?.amountEur ?? null);
  const yearlyView = toBillingPriceView(plan, "year", yearlyPrice, monthlyPrice?.amountEur ?? null);
  const pricingOptions = [monthlyView, yearlyView].filter((option) => option.priceId !== null || STRIPE_ENABLED);
  const planName = monthlyPrice?.productName ?? yearlyPrice?.productName ?? plan.defaultName;

  return {
    code: plan.code,
    name: planName,
    seatLimit: plan.seatLimit,
    isDemo: false,
    checkoutEnabled: pricingOptions.some((option) => option.checkoutEnabled),
    pricingOptions
  };
};

const buildPlansCatalog = async (): Promise<Record<BillingPlanCode, BillingPlanView>> => {
  const catalog = await loadStripeCatalog();

  return {
    DEMO_10: buildPlanView(BILLING_PLANS.DEMO_10, catalog),
    PACK_10: buildPlanView(BILLING_PLANS.PACK_10, catalog),
    PACK_20: buildPlanView(BILLING_PLANS.PACK_20, catalog),
    PACK_50: buildPlanView(BILLING_PLANS.PACK_50, catalog),
    PACK_100: buildPlanView(BILLING_PLANS.PACK_100, catalog)
  };
};

const resolveCurrentPriceView = (
  plan: BillingPlanView,
  subscription: BillingSubscriptionRecord | null
): BillingPriceView | null => {
  if (!subscription?.stripePriceId) {
    return plan.pricingOptions.find((option) => option.interval === "month" && option.checkoutEnabled) ?? plan.pricingOptions[0] ?? null;
  }

  return plan.pricingOptions.find((option) => option.priceId === subscription.stripePriceId) ?? plan.pricingOptions[0] ?? null;
};

const toIsoFromUnix = (value: number | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).toISOString();
};

const getCheckoutPriceConfig = (priceId: string): BillingPriceConfig => {
  const trimmed = priceId.trim();
  const config = STRIPE_PRICE_CONFIGS.find((item) => item.priceId === trimmed);
  if (!config) {
    throw new AppError("Selected billing price is not available for checkout.", 400);
  }

  return config;
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

  const config = STRIPE_PRICE_CONFIGS.find((item) => item.priceId === priceId);
  if (!config) {
    return null;
  }

  return BILLING_PLANS[config.planCode];
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

const addMonthsUtc = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const resolveBillingDeletionDeadline = (subscription: BillingSubscriptionRecord): Date => {
  const referenceDate = subscription.trialEndsAt ?? subscription.currentPeriodEnd ?? subscription.updatedAt ?? subscription.createdAt;
  return addMonthsUtc(referenceDate, 6);
};

const resolveEffectiveSeatLimit = (subscription: BillingSubscriptionRecord): EffectiveSeatLimit => {
  if (typeof subscription.customSeatLimit === "number") {
    return {
      source: "CUSTOM",
      limit: subscription.customSeatLimit
    };
  }

  return {
    source: "SUBSCRIPTION",
    limit: subscription.seatLimit
  };
};

const buildAdminSeatLimitControlView = async (
  admin: AdminSeatLimitAdminRecord,
  seatCountMap: Map<string, number>,
  plansCatalog: Record<BillingPlanCode, BillingPlanView>
): Promise<AdminSeatLimitControlView> => {
  const subscription = admin.billingSubscription ?? (await loadOrCreateAdminSubscription(admin.id));
  const effectiveSeatLimit = resolveEffectiveSeatLimit(subscription);
  const used = seatCountMap.get(admin.id) ?? 0;
  const plan = plansCatalog[subscription.planCode];

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName
    },
    billing: {
      planCode: subscription.planCode,
      status: subscription.status,
      seatLimitSource: effectiveSeatLimit.source,
      subscriptionSeatLimit: subscription.seatLimit,
      effectiveSeatLimit: effectiveSeatLimit.limit,
      customSeatLimit: subscription.customSeatLimit,
      customSeatLimitUpdatedAt: normalizeDate(subscription.customSeatLimitUpdatedAt),
      isTrial: subscription.isTrial,
      trialEndsAt: normalizeDate(subscription.trialEndsAt),
      currentPeriodEnd: normalizeDate(subscription.currentPeriodEnd),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPrice: resolveCurrentPriceView(plan, subscription)
    },
    seatUsage: {
      used,
      limit: effectiveSeatLimit.limit,
      remaining: Math.max(0, effectiveSeatLimit.limit - used)
    }
  } satisfies AdminSeatLimitControlView;
};

const isAdminSeatControlHealthy = (control: AdminSeatLimitControlView): boolean => {
  return control.billing.seatLimitSource === "CUSTOM" || ACTIVE_BILLING_STATUSES.has(control.billing.status);
};

const isAdminSeatControlTrialEndingSoon = (control: AdminSeatLimitControlView): boolean => {
  if (!control.billing.isTrial || control.billing.seatLimitSource === "CUSTOM" || !control.billing.trialEndsAt) {
    return false;
  }

  const endsAt = new Date(control.billing.trialEndsAt).getTime();
  const diffDays = Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};

const isAdminSeatControlNearCapacity = (control: AdminSeatLimitControlView): boolean => {
  if (control.seatUsage.limit <= 0 || control.seatUsage.used >= control.seatUsage.limit) {
    return false;
  }

  return control.seatUsage.used / control.seatUsage.limit >= 0.9;
};

const adminSeatControlNeedsAttention = (control: AdminSeatLimitControlView): boolean => {
  if (!isAdminSeatControlHealthy(control)) {
    return true;
  }

  if (control.seatUsage.used >= control.seatUsage.limit || isAdminSeatControlNearCapacity(control)) {
    return true;
  }

  if (isAdminSeatControlTrialEndingSoon(control)) {
    return true;
  }

  return control.billing.cancelAtPeriodEnd && control.billing.seatLimitSource !== "CUSTOM";
};

const buildAdminSeatLimitStats = (controls: AdminSeatLimitControlView[]): AdminSeatLimitControlsStats => {
  return {
    totalAdmins: controls.length,
    totalManagedSeatsUsed: controls.reduce((total, control) => total + control.seatUsage.used, 0),
    totalManagedSeatsLimit: controls.reduce((total, control) => total + control.seatUsage.limit, 0),
    totalManualOverrides: controls.filter((control) => control.billing.seatLimitSource === "CUSTOM").length,
    totalAttentionAdmins: controls.filter((control) => adminSeatControlNeedsAttention(control)).length
  };
};

const buildAdminSeatLimitStatsSummary = async (): Promise<AdminSeatLimitControlsStats> => {
  const adminWhere: Prisma.UserWhereInput = {
    role: "ADMIN",
    isActive: true
  };

  const [totalAdmins, totalManagedSeatsUsed, subscriptions] = await Promise.all([
    prisma.user.count({
      where: adminWhere
    }),
    prisma.user.count({
      where: {
        role: "EMPLOYEE",
        manager: {
          is: adminWhere
        }
      }
    }),
    prisma.billingSubscription.findMany({
      where: {
        admin: adminWhere
      },
      select: BILLING_SUBSCRIPTION_SELECT
    })
  ]);

  if (subscriptions.length === 0) {
    return {
      totalAdmins,
      totalManagedSeatsUsed,
      totalManagedSeatsLimit: 0,
      totalManualOverrides: 0,
      totalAttentionAdmins: 0
    };
  }

  const seatCounts = await prisma.user.groupBy({
    by: ["managerId"],
    where: {
      role: "EMPLOYEE",
      managerId: {
        in: subscriptions.map((subscription) => subscription.adminId)
      }
    },
    _count: {
      _all: true
    }
  });

  const seatCountMap = new Map<string, number>();
  for (const row of seatCounts) {
    if (row.managerId) {
      seatCountMap.set(row.managerId, row._count._all);
    }
  }

  let totalManagedSeatsLimit = 0;
  let totalManualOverrides = 0;
  let totalAttentionAdmins = 0;

  for (const subscription of subscriptions) {
    const effectiveSeatLimit = resolveEffectiveSeatLimit(subscription);
    const usedSeats = seatCountMap.get(subscription.adminId) ?? 0;
    const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() : null;
    const trialEndsDiffDays = trialEndsAt ? Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    totalManagedSeatsLimit += effectiveSeatLimit.limit;

    if (effectiveSeatLimit.source === "CUSTOM") {
      totalManualOverrides += 1;
    }

    const hasHealthyBilling = effectiveSeatLimit.source === "CUSTOM" || ACTIVE_BILLING_STATUSES.has(subscription.status);
    const isNearCapacity = effectiveSeatLimit.limit > 0 && usedSeats < effectiveSeatLimit.limit && usedSeats / effectiveSeatLimit.limit >= 0.9;
    const isTrialEndingSoon =
      subscription.isTrial &&
      effectiveSeatLimit.source !== "CUSTOM" &&
      trialEndsDiffDays !== null &&
      trialEndsDiffDays >= 0 &&
      trialEndsDiffDays <= 3;

    if (
      !hasHealthyBilling ||
      usedSeats >= effectiveSeatLimit.limit ||
      isNearCapacity ||
      isTrialEndingSoon ||
      (subscription.cancelAtPeriodEnd && effectiveSeatLimit.source !== "CUSTOM")
    ) {
      totalAttentionAdmins += 1;
    }
  }

  return {
    totalAdmins,
    totalManagedSeatsUsed,
    totalManagedSeatsLimit,
    totalManualOverrides,
    totalAttentionAdmins
  };
};

const getAttendanceAccessForAdminRecord = (subscription: BillingSubscriptionRecord): AttendanceAccessSummary => {
  const effectiveSeatLimit = resolveEffectiveSeatLimit(subscription);
  if (effectiveSeatLimit.source === "CUSTOM" || isSubscriptionUsable(subscription)) {
    return {
      canRecordAttendance: true,
      reason: "OK",
      managedByAdminId: subscription.adminId,
      managedByAdminName: null,
      requiresSubscriptionAction: false,
      dataDeletionAt: null
    };
  }

  return {
    canRecordAttendance: false,
    reason: "BILLING_INACTIVE",
    managedByAdminId: subscription.adminId,
    managedByAdminName: null,
    requiresSubscriptionAction: true,
    dataDeletionAt: normalizeDate(resolveBillingDeletionDeadline(subscription))
  };
};

const buildBillingSummary = async (
  role: Role,
  subscription: BillingSubscriptionRecord | null,
  userId: string
): Promise<BillingSummary | null> => {
  if (role === "EMPLOYEE") {
    return null;
  }

  const plansCatalog = await buildPlansCatalog();

  if (role === "SUPERADMIN") {
    const plan = plansCatalog.PACK_100;
    return {
      isBypassed: true,
      stripeConfigured: STRIPE_ENABLED,
      plan,
      currentPrice: resolveCurrentPriceView(plan, null),
      status: "BYPASSED",
      seatLimitSource: "BYPASSED",
      seatUsage: {
        used: 0,
        limit: plan.seatLimit,
        remaining: plan.seatLimit
      },
      customSeatLimit: null,
      customSeatLimitUpdatedAt: null,
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
  const plan = plansCatalog[ensuredSubscription.planCode];
  const used = await getManagedEmployeesCount(userId);
  const effectiveSeatLimit = resolveEffectiveSeatLimit(ensuredSubscription);
  const remaining = Math.max(0, effectiveSeatLimit.limit - used);

  return {
    isBypassed: false,
    stripeConfigured: STRIPE_ENABLED,
    plan,
    currentPrice: resolveCurrentPriceView(plan, ensuredSubscription),
    status: ensuredSubscription.status,
    seatLimitSource: effectiveSeatLimit.source,
    seatUsage: {
      used,
      limit: effectiveSeatLimit.limit,
      remaining
    },
    customSeatLimit: ensuredSubscription.customSeatLimit,
    customSeatLimitUpdatedAt: normalizeDate(ensuredSubscription.customSeatLimitUpdatedAt),
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

export const listBillingPlans = async (): Promise<BillingPlanView[]> => {
  const plansCatalog = await buildPlansCatalog();
  return [
    plansCatalog.DEMO_10,
    plansCatalog.PACK_10,
    plansCatalog.PACK_20,
    plansCatalog.PACK_50,
    plansCatalog.PACK_100
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
    plans: await listBillingPlans(),
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
  const effectiveSeatLimit = resolveEffectiveSeatLimit(subscription);

  if (effectiveSeatLimit.source !== "CUSTOM" && !isSubscriptionUsable(subscription)) {
    throw new AppError("Your billing plan is not active. Upgrade or renew it before adding more employees.", 403);
  }

  const usedSeats = await getManagedEmployeesCount(admin.id);
  if (usedSeats >= effectiveSeatLimit.limit) {
    throw new AppError("Your current billing plan does not allow more employees.", 409);
  }
};

export const createCheckoutSessionForAdmin = async (params: { requesterId: string; priceId: string }) => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "ADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const stripeClient = ensureStripeReady();
  const selectedPrice = getCheckoutPriceConfig(params.priceId);
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
        price: selectedPrice.priceId as string,
        quantity: 1
      }
    ],
    metadata: {
      adminId: requester.id,
      planCode: selectedPrice.planCode
    },
    subscription_data: {
      metadata: {
        adminId: requester.id,
        planCode: selectedPrice.planCode
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

export const getAttendanceAccessForUser = async (userId: string): Promise<AttendanceAccessSummary> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      managerId: true,
      isActive: true,
      manager: {
        select: {
          id: true,
          fullName: true,
          role: true,
          isActive: true
        }
      }
    }
  });

  if (!user || !user.isActive) {
    throw new AppError("User not found.", 404);
  }

  if (user.role === "SUPERADMIN") {
    return {
      canRecordAttendance: false,
      reason: "NOT_APPLICABLE",
      managedByAdminId: null,
      managedByAdminName: null,
      requiresSubscriptionAction: false,
      dataDeletionAt: null
    };
  }

  if (user.role === "ADMIN") {
    const subscription = await loadOrCreateAdminSubscription(user.id);
    return getAttendanceAccessForAdminRecord(subscription);
  }

  if (!user.managerId || !user.manager || user.manager.role !== "ADMIN" || !user.manager.isActive) {
    return {
      canRecordAttendance: false,
      reason: "TEAM_ASSIGNMENT_REQUIRED",
      managedByAdminId: null,
      managedByAdminName: null,
      requiresSubscriptionAction: false,
      dataDeletionAt: null
    };
  }

  const managerSubscription = await loadOrCreateAdminSubscription(user.manager.id);
  const managerAccess = getAttendanceAccessForAdminRecord(managerSubscription);

  return {
    ...managerAccess,
    managedByAdminId: user.manager.id,
    managedByAdminName: user.manager.fullName
  };
};

export const assertNonBillingFeatureAccessForUser = async (userId: string): Promise<void> => {
  const access = await getAttendanceAccessForUser(userId);
  if (access.reason === "BILLING_INACTIVE") {
    throw new AppError("This section is unavailable while billing is inactive.", 403);
  }
};

export const getAdminSeatUsage = async (adminId: string): Promise<{ used: number; limit: number }> => {
  const subscription = await loadOrCreateAdminSubscription(adminId);
  const effectiveSeatLimit = resolveEffectiveSeatLimit(subscription);
  const used = await getManagedEmployeesCount(adminId);
  return {
    used,
    limit: effectiveSeatLimit.limit
  };
};

const notifyAdminCustomSeatLimitChange = async (params: {
  adminId: string;
  adminName: string;
  actorName: string;
  customSeatLimit: number | null;
}): Promise<void> => {
  const isRemoval = params.customSeatLimit === null;

  await createNotificationsForUsers({
    userIds: [params.adminId],
    type: "SYSTEM",
    title: isRemoval ? "Límite personalizado retirado" : "Límite personalizado actualizado",
    body: isRemoval
      ? `${params.actorName} ha retirado tu límite personalizado de usuarios. Tu cuenta vuelve a usar el control de plazas de la suscripción.`
      : `${params.actorName} ha fijado tu límite personalizado de usuarios en ${params.customSeatLimit} plazas. Este límite tiene prioridad sobre tu suscripción hasta que se retire.`,
    i18n: isRemoval
      ? {
          titleKey: "notifications.billing_custom_limit_removed_title",
          bodyKey: "notifications.billing_custom_limit_removed_body",
          params: {
            actor: params.actorName
          }
        }
      : {
          titleKey: "notifications.billing_custom_limit_set_title",
          bodyKey: "notifications.billing_custom_limit_set_body",
          params: {
            actor: params.actorName,
            limit: params.customSeatLimit ?? 0
          }
        },
    metadata: {
      route: "/billing",
      adminId: params.adminId,
      adminName: params.adminName,
      customSeatLimit: params.customSeatLimit
    }
  });
};

export const listAdminSeatLimitControls = async (params: {
  requesterId: string;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedAdminSeatLimitControlsResult> => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "SUPERADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const trimmedSearch = params.search?.trim();
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
  const page = Math.max(1, params.page ?? 1);
  const skip = (page - 1) * pageSize;

  const baseWhere: Prisma.UserWhereInput = {
    role: "ADMIN",
    isActive: true
  };

  const where: Prisma.UserWhereInput = {
    ...baseWhere
  };

  if (trimmedSearch) {
    where.OR = [{ fullName: { contains: trimmedSearch, mode: "insensitive" } }, { email: { contains: trimmedSearch, mode: "insensitive" } }];
  }

  const [stats, filteredTotal, pagedAdmins] = await Promise.all([
    buildAdminSeatLimitStatsSummary(),
    prisma.user.count({
      where
    }),
    prisma.user.findMany({
      where,
      select: ADMIN_SEAT_LIMIT_CONTROL_SELECT,
      orderBy: [{ fullName: "asc" }],
      skip,
      take: pageSize
    })
  ]);

  const adminIds = pagedAdmins.map((admin) => admin.id);
  const seatCounts =
    adminIds.length > 0
      ? await prisma.user.groupBy({
          by: ["managerId"],
          where: {
            role: "EMPLOYEE",
            managerId: {
              in: adminIds
            }
          },
          _count: {
            _all: true
          }
        })
      : [];

  const seatCountMap = new Map<string, number>();
  for (const row of seatCounts) {
    if (row.managerId) {
      seatCountMap.set(row.managerId, row._count._all);
    }
  }

  const plansCatalog = await buildPlansCatalog();
  const pagedControls = await Promise.all(pagedAdmins.map((admin) => buildAdminSeatLimitControlView(admin, seatCountMap, plansCatalog)));

  return {
    admins: pagedControls,
    total: filteredTotal,
    page,
    pageSize,
    stats
  };
};

export const setAdminCustomSeatLimit = async (params: {
  requesterId: string;
  adminId: string;
  seatLimit: number;
}): Promise<AdminSeatLimitControlView> => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "SUPERADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const admin = await prisma.user.findUnique({
    where: { id: params.adminId },
    select: {
      id: true,
      email: true,
      fullName: true,
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

  await loadOrCreateAdminSubscription(admin.id);

  await prisma.billingSubscription.update({
    where: { adminId: admin.id },
    data: {
      customSeatLimit: params.seatLimit,
      customSeatLimitUpdatedAt: new Date(),
      customSeatLimitUpdatedById: requester.id
    }
  });

  await notifyAdminCustomSeatLimitChange({
    adminId: admin.id,
    adminName: admin.fullName,
    actorName: requester.fullName,
    customSeatLimit: params.seatLimit
  });

  const adminRecord = await prisma.user.findUnique({
    where: { id: admin.id },
    select: ADMIN_SEAT_LIMIT_CONTROL_SELECT
  });

  if (!adminRecord) {
    throw new AppError("User not found.", 404);
  }

  const plansCatalog = await buildPlansCatalog();
  return buildAdminSeatLimitControlView(adminRecord, new Map([[admin.id, await getManagedEmployeesCount(admin.id)]]), plansCatalog);
};

export const clearAdminCustomSeatLimit = async (params: {
  requesterId: string;
  adminId: string;
}): Promise<AdminSeatLimitControlView> => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "SUPERADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const admin = await prisma.user.findUnique({
    where: { id: params.adminId },
    select: {
      id: true,
      email: true,
      fullName: true,
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

  await loadOrCreateAdminSubscription(admin.id);

  await prisma.billingSubscription.update({
    where: { adminId: admin.id },
    data: {
      customSeatLimit: null,
      customSeatLimitUpdatedAt: new Date(),
      customSeatLimitUpdatedById: requester.id
    }
  });

  await notifyAdminCustomSeatLimitChange({
    adminId: admin.id,
    adminName: admin.fullName,
    actorName: requester.fullName,
    customSeatLimit: null
  });

  const adminRecord = await prisma.user.findUnique({
    where: { id: admin.id },
    select: ADMIN_SEAT_LIMIT_CONTROL_SELECT
  });

  if (!adminRecord) {
    throw new AppError("User not found.", 404);
  }

  const plansCatalog = await buildPlansCatalog();
  return buildAdminSeatLimitControlView(adminRecord, new Map([[admin.id, await getManagedEmployeesCount(admin.id)]]), plansCatalog);
};

const listStripeInvoicesForCustomer = async (customerId: string): Promise<BillingPaymentRecord[]> => {
  if (!stripe) {
    return [];
  }

  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: 100
  });

  return invoices.data.map((invoice) => {
    const rawInvoice = invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    };

    return {
    invoiceId: invoice.id ?? "",
    stripeSubscriptionId:
      typeof rawInvoice.subscription === "string"
        ? rawInvoice.subscription
        : rawInvoice.subscription?.id ?? null,
    status: invoice.status ?? "unknown",
    currency: invoice.currency?.toUpperCase() ?? null,
    amountDueEur: centsToEur(invoice.amount_due),
    amountPaidEur: centsToEur(invoice.amount_paid),
    amountRemainingEur: centsToEur(invoice.amount_remaining),
    createdAt: toIsoFromUnix(invoice.created),
    dueAt: toIsoFromUnix(invoice.due_date),
    paidAt: invoice.status_transitions?.paid_at ? toIsoFromUnix(invoice.status_transitions.paid_at) : null,
    periodStart: toIsoFromUnix(invoice.period_start),
    periodEnd: toIsoFromUnix(invoice.period_end),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null
  };
  });
};

const buildPaymentStats = (payments: BillingPaymentRecord[]) => {
  const paidPayments = payments.filter((payment) => payment.amountPaidEur !== null && payment.amountPaidEur > 0);
  const totalPaidEur = roundMoney(paidPayments.reduce((sum, payment) => sum + (payment.amountPaidEur ?? 0), 0));
  const lastPaymentAt = paidPayments
    .map((payment) => payment.paidAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    paidInvoicesCount: paidPayments.length,
    totalPaidEur,
    lastPaymentAt
  };
};

export const getBillingPaymentsHistoryForUser = async (params: {
  requesterId: string;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<BillingPaymentsHistoryResponse> => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "ADMIN" && requester.role !== "SUPERADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const trimmedSearch = params.search?.trim();
  const requestedPageSize = Math.min(100, Math.max(1, params.pageSize ?? 6));
  const requestedPage = Math.max(1, params.page ?? 1);

  const where: Prisma.BillingSubscriptionWhereInput =
    requester.role === "ADMIN"
      ? {
          adminId: requester.id
        }
      : {
          admin: {
            role: "ADMIN",
            ...(trimmedSearch
              ? {
                  OR: [
                    {
                      fullName: {
                        contains: trimmedSearch,
                        mode: "insensitive"
                      }
                    },
                    {
                      email: {
                        contains: trimmedSearch,
                        mode: "insensitive"
                      }
                    }
                  ]
                }
              : {})
          }
        };

  const total = await prisma.billingSubscription.count({ where });
  const page = requester.role === "SUPERADMIN" ? requestedPage : 1;
  const pageSize = requester.role === "SUPERADMIN" ? requestedPageSize : Math.max(1, total || 1);
  const subscriptions = await prisma.billingSubscription.findMany({
    where,
    select: {
      adminId: true,
      planCode: true,
      status: true,
      seatLimit: true,
      isTrial: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      admin: {
        select: {
          id: true,
          email: true,
          fullName: true
        }
      }
    },
    orderBy: [
      {
        admin: {
          fullName: "asc"
        }
      }
    ],
    ...(requester.role === "SUPERADMIN"
      ? {
          skip: (page - 1) * pageSize,
          take: pageSize
        }
      : {})
  });

  const accounts = await Promise.all(
    subscriptions.map(async (subscription) => {
      const payments = STRIPE_ENABLED && subscription.stripeCustomerId ? await listStripeInvoicesForCustomer(subscription.stripeCustomerId) : [];

      return {
        admin: subscription.admin,
        subscription: {
          planCode: subscription.planCode,
          status: subscription.status,
          seatLimit: subscription.seatLimit,
          isTrial: subscription.isTrial,
          trialEndsAt: normalizeDate(subscription.trialEndsAt),
          currentPeriodEnd: normalizeDate(subscription.currentPeriodEnd),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          stripeCustomerId: subscription.stripeCustomerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId
        },
        paymentStats: buildPaymentStats(payments),
        payments
      };
    })
  );

  return {
    scope: requester.role === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN",
    stripeConfigured: STRIPE_ENABLED,
    accounts,
    total,
    page,
    pageSize
  };
};

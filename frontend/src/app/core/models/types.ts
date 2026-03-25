export type Role = "SUPERADMIN" | "ADMIN" | "EMPLOYEE";
export type EditRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type TeamJoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type NotificationType =
  | "EDIT_REQUEST_CREATED"
  | "EDIT_REQUEST_APPROVED"
  | "EDIT_REQUEST_REJECTED"
  | "EVENT_MODIFIED"
  | "TEAM_JOIN_REQUEST_CREATED"
  | "TEAM_JOIN_REQUEST_APPROVED"
  | "TEAM_JOIN_REQUEST_REJECTED"
  | "SYSTEM";
export type PushPlatform = "WEB" | "ANDROID" | "IOS";
export type BillingPlanCode = "DEMO_10" | "PACK_10" | "PACK_20" | "PACK_50" | "PACK_100";
export type BillingInterval = "month" | "year";
export type BillingSeatLimitSource = "BYPASSED" | "SUBSCRIPTION" | "CUSTOM";
export type BillingSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "UNPAID";

export interface BillingPriceOption {
  interval: BillingInterval;
  priceId: string | null;
  amountEur: number | null;
  currency: string | null;
  pricePerSeatEur: number | null;
  monthlyEquivalentEur: number | null;
  savingsVsMonthlyPercent: number | null;
  checkoutEnabled: boolean;
}

export interface BillingPlan {
  code: BillingPlanCode;
  name: string;
  seatLimit: number;
  isDemo: boolean;
  checkoutEnabled: boolean;
  pricingOptions: BillingPriceOption[];
}

export interface BillingSummary {
  isBypassed: boolean;
  stripeConfigured: boolean;
  plan: BillingPlan;
  currentPrice: BillingPriceOption | null;
  status: BillingSubscriptionStatus | "BYPASSED";
  seatLimitSource: BillingSeatLimitSource;
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
}

export interface AttendanceAccessSummary {
  canRecordAttendance: boolean;
  reason: "OK" | "TEAM_ASSIGNMENT_REQUIRED" | "BILLING_INACTIVE";
  managedByAdminId: string | null;
  managedByAdminName: string | null;
  requiresSubscriptionAction: boolean;
  dataDeletionAt: string | null;
}

export interface AdminSeatLimitControl {
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
  };
  seatUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
}

export interface BillingPaymentRecord {
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
}

export interface BillingAccountPaymentsView {
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
}

export interface BillingPaymentsHistoryResponse {
  scope: "ADMIN" | "SUPERADMIN";
  stripeConfigured: boolean;
  accounts: BillingAccountPaymentsView[];
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  role: Role;
  adminInviteCode?: string | null;
  managerId?: string | null;
  isActive: boolean;
  createdAt: string;
  billing?: BillingSummary | null;
  attendanceAccess?: AttendanceAccessSummary | null;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    profilePhotoUrl?: string | null;
    role: Role;
    adminInviteCode?: string | null;
  };
}

export type WorkEventType = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT" | "MANUAL_ADJUSTMENT";

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  profilePhotoUrl?: string | null;
}

export interface WorkEvent {
  id: string;
  userId?: string;
  type: WorkEventType;
  source: "WEB" | "MOBILE" | "ADMIN" | "SYSTEM";
  eventAt: string;
  note?: string | null;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  modifiedAt?: string | null;
  modificationReason?: string | null;
  modifiedBy?: UserSummary | null;
}

export interface WorkEventEditRequestSummary {
  id: string;
  status: EditRequestStatus;
  reason: string;
  requestedEventAt: string;
  requestedNote: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedBy: UserSummary | null;
  reviewedBy: UserSummary | null;
}

export interface AttendanceEventRecord extends WorkEvent {
  userId: string;
  user: UserSummary;
  modifiedBy: UserSummary | null;
  editRequests: WorkEventEditRequestSummary[];
}

export interface WorkEventEditRequestRecord {
  id: string;
  status: EditRequestStatus;
  reason: string;
  requestedEventAt: string;
  requestedNote: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedBy: UserSummary;
  reviewedBy: UserSummary | null;
  workEvent: {
    id: string;
    type: WorkEventType;
    eventAt: string;
    user: UserSummary;
  };
}

export interface TodayStatus {
  date: string;
  state: "OFF" | "WORKING" | "ON_BREAK";
  totals: {
    workedMinutes: number;
    breakMinutes: number;
    adjustmentsMinutes: number;
    overtimeMinutes: number;
  };
  events: WorkEvent[];
}

export interface SummaryRow {
  date: string;
  userId: string;
  employee: string;
  email: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  adjustmentsMinutes: number;
  status: "OPEN" | "CLOSED";
}

export interface TeamUser {
  id: string;
  email: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  adminInviteCode?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  manager: UserSummary | null;
  managedEmployeesCount: number;
}

export interface TeamJoinRequest {
  id: string;
  inviteCodeUsed: string;
  status: TeamJoinRequestStatus;
  message: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employee: UserSummary & {
    managerId?: string | null;
  };
  targetManager: UserSummary;
  reviewedBy: UserSummary | null;
}

export interface UserNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

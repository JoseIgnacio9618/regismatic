export type Role = "SUPERADMIN" | "ADMIN" | "EMPLOYEE";
export type EditRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type NotificationType =
  | "EDIT_REQUEST_CREATED"
  | "EDIT_REQUEST_APPROVED"
  | "EDIT_REQUEST_REJECTED"
  | "EVENT_MODIFIED"
  | "SYSTEM";
export type PushPlatform = "WEB" | "ANDROID" | "IOS";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  role: Role;
  managerId?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    profilePhotoUrl?: string | null;
    role: Role;
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
  requestedBy: UserSummary;
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
  role: Role;
  isActive: boolean;
  createdAt: string;
  manager: UserSummary | null;
  managedEmployeesCount: number;
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

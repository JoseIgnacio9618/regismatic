export type Role = "ADMIN" | "EMPLOYEE";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
}

export type WorkEventType = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT" | "MANUAL_ADJUSTMENT";

export interface WorkEvent {
  id: string;
  type: WorkEventType;
  source: "WEB" | "MOBILE" | "ADMIN" | "SYSTEM";
  eventAt: string;
  note?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
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
  role: Role;
  isActive: boolean;
  createdAt: string;
}

import { Injectable } from "@angular/core";
import { AdminSeatLimitControl, BillingPaymentsHistoryResponse, BillingPlan, BillingSummary } from "../models/types";
import { ApiService } from "./api.service";

type BillingOverviewResponse = {
  plans: BillingPlan[];
  summary: BillingSummary | null;
};

type AdminSeatLimitControlsResponse = {
  admins: AdminSeatLimitControl[];
};

@Injectable({ providedIn: "root" })
export class BillingService {
  constructor(private readonly apiService: ApiService) {}

  getOverview(): Promise<BillingOverviewResponse> {
    return this.apiService.get<BillingOverviewResponse>("/billing/overview", true);
  }

  getPaymentsHistory(): Promise<BillingPaymentsHistoryResponse> {
    return this.apiService.get<BillingPaymentsHistoryResponse>("/billing/payments-history", true);
  }

  getAdminSeatLimitControls(): Promise<AdminSeatLimitControlsResponse> {
    return this.apiService.get<AdminSeatLimitControlsResponse>("/billing/admin-seat-limits", true);
  }

  createCheckoutSession(priceId: string): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/checkout-session", { priceId }, true);
  }

  createPortalSession(): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/portal-session", {}, true);
  }

  setAdminCustomSeatLimit(adminId: string, seatLimit: number): Promise<AdminSeatLimitControl> {
    return this.apiService.patch<AdminSeatLimitControl>(`/billing/admins/${adminId}/custom-seat-limit`, { seatLimit }, true);
  }

  clearAdminCustomSeatLimit(adminId: string): Promise<AdminSeatLimitControl> {
    return this.apiService.delete<AdminSeatLimitControl>(`/billing/admins/${adminId}/custom-seat-limit`, true);
  }
}

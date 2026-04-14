import { Injectable } from "@angular/core";
import {
  AdminSeatLimitControl,
  BillingPaymentsHistoryResponse,
  BillingPlan,
  BillingSummary,
  PaginatedAdminSeatLimitControlsResponse
} from "../models/types";
import { ApiService } from "./api.service";

type BillingOverviewResponse = {
  plans: BillingPlan[];
  summary: BillingSummary | null;
};

@Injectable({ providedIn: "root" })
export class BillingService {
  constructor(private readonly apiService: ApiService) {}

  getOverview(): Promise<BillingOverviewResponse> {
    return this.apiService.get<BillingOverviewResponse>("/billing/overview", true);
  }

  getPaymentsHistory(params?: { page?: number; pageSize?: number; search?: string }): Promise<BillingPaymentsHistoryResponse> {
    const query = new URLSearchParams();
    if (params?.page) {
      query.set("page", String(params.page));
    }
    if (params?.pageSize) {
      query.set("pageSize", String(params.pageSize));
    }
    if (params?.search?.trim()) {
      query.set("search", params.search.trim());
    }

    const queryString = query.toString();
    return this.apiService.get<BillingPaymentsHistoryResponse>(`/billing/payments-history${queryString ? `?${queryString}` : ""}`, true);
  }

  getAdminSeatLimitControls(params?: { page?: number; pageSize?: number; search?: string }): Promise<PaginatedAdminSeatLimitControlsResponse> {
    const query = new URLSearchParams();
    if (params?.page) {
      query.set("page", String(params.page));
    }
    if (params?.pageSize) {
      query.set("pageSize", String(params.pageSize));
    }
    if (params?.search?.trim()) {
      query.set("search", params.search.trim());
    }

    const queryString = query.toString();
    return this.apiService.get<PaginatedAdminSeatLimitControlsResponse>(
      `/billing/admin-seat-limits${queryString ? `?${queryString}` : ""}`,
      true
    );
  }

  async listAllAdminSeatLimitControls(params?: { search?: string }): Promise<AdminSeatLimitControl[]> {
    const pageSize = 100;
    let page = 1;
    let admins: AdminSeatLimitControl[] = [];

    while (true) {
      const response = await this.getAdminSeatLimitControls({ ...params, page, pageSize });
      admins = admins.concat(response.admins);

      if (admins.length >= response.total || response.admins.length === 0) {
        return admins;
      }

      page += 1;
    }
  }

  createCheckoutSession(priceId: string): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/checkout-session", { priceId }, true);
  }

  createPortalSession(): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/portal-session", {}, true);
  }

  cancelSubscription(): Promise<BillingSummary> {
    return this.apiService.post<BillingSummary>("/billing/subscription/cancel", {}, true);
  }

  reactivateSubscription(): Promise<BillingSummary> {
    return this.apiService.post<BillingSummary>("/billing/subscription/reactivate", {}, true);
  }

  setAdminCustomSeatLimit(adminId: string, seatLimit: number): Promise<AdminSeatLimitControl> {
    return this.apiService.patch<AdminSeatLimitControl>(`/billing/admins/${adminId}/custom-seat-limit`, { seatLimit }, true);
  }

  clearAdminCustomSeatLimit(adminId: string): Promise<AdminSeatLimitControl> {
    return this.apiService.delete<AdminSeatLimitControl>(`/billing/admins/${adminId}/custom-seat-limit`, true);
  }
}

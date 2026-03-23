import { Injectable } from "@angular/core";
import { BillingPaymentsHistoryResponse, BillingPlan, BillingSummary } from "../models/types";
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

  getPaymentsHistory(): Promise<BillingPaymentsHistoryResponse> {
    return this.apiService.get<BillingPaymentsHistoryResponse>("/billing/payments-history", true);
  }

  createCheckoutSession(priceId: string): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/checkout-session", { priceId }, true);
  }

  createPortalSession(): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/portal-session", {}, true);
  }
}

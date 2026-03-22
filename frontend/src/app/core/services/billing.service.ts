import { Injectable } from "@angular/core";
import { BillingPlan, BillingPlanCode, BillingSummary } from "../models/types";
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

  createCheckoutSession(planCode: Exclude<BillingPlanCode, "DEMO_10">): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/checkout-session", { planCode }, true);
  }

  createPortalSession(): Promise<{ url: string }> {
    return this.apiService.post<{ url: string }>("/billing/portal-session", {}, true);
  }
}

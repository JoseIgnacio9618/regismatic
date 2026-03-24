import { Component, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { BillingInterval, BillingPlan, BillingPriceOption, BillingSummary } from "src/app/core/models/types";
import { AuthService } from "src/app/core/services/auth.service";
import { BillingService } from "src/app/core/services/billing.service";
import { I18nService } from "src/app/core/services/i18n.service";

@Component({
  selector: "app-billing",
  templateUrl: "./billing.page.html",
  styleUrls: ["./billing.page.scss"],
  standalone: false
})
export class BillingPage implements OnInit {
  plans: BillingPlan[] = [];
  summary: BillingSummary | null = null;
  loading = false;
  actionLoading = false;
  selectedInterval: BillingInterval = "month";

  constructor(
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    private readonly billingService: BillingService,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadOverview();
  }

  get paidPlans(): BillingPlan[] {
    return this.plans.filter((plan) => !plan.isDemo);
  }

  get isAdminBilling(): boolean {
    return this.authService.user?.role === "ADMIN";
  }

  formatCurrentPrice(billing: BillingSummary): string {
    if (billing.isTrial || !billing.currentPrice?.amountEur) {
      return this.i18nService.t("billing.free");
    }

    return this.formatPriceOption(billing.currentPrice);
  }

  formatCycleLabel(interval: BillingInterval): string {
    return this.i18nService.t(interval === "year" ? "billing.yearly" : "billing.monthly");
  }

  formatPriceOption(price: BillingPriceOption): string {
    if (!price.amountEur) {
      return this.i18nService.t("billing.not_available");
    }

    const intervalKey = price.interval === "year" ? "billing.year_short" : "billing.month_short";
    return `${price.amountEur} EUR/${this.i18nService.t(intervalKey)}`;
  }

  formatPriceHint(price: BillingPriceOption): string {
    if (price.interval === "year" && price.monthlyEquivalentEur) {
      return this.i18nService.t("billing.year_equivalent", {
        amount: price.monthlyEquivalentEur
      });
    }

    if (price.pricePerSeatEur) {
      return this.i18nService.t("billing.per_user_value", {
        amount: price.pricePerSeatEur
      });
    }

    return this.i18nService.t("billing.not_available");
  }

  setSelectedInterval(interval: string | number | null | undefined): void {
    if (interval === "month" || interval === "year") {
      this.selectedInterval = interval;
    }
  }

  currentCycleLabel(billing: BillingSummary): string {
    if (billing.isTrial || !billing.currentPrice) {
      return this.i18nService.t("billing.free");
    }

    return this.formatCycleLabel(billing.currentPrice.interval);
  }

  selectedPriceFor(plan: BillingPlan): BillingPriceOption | null {
    return plan.pricingOptions.find((price) => price.interval === this.selectedInterval) ?? null;
  }

  isCurrentPlan(plan: BillingPlan): boolean {
    return this.summary?.plan.code === plan.code;
  }

  isCurrentPrice(price: BillingPriceOption | null | undefined): boolean {
    return !!price?.priceId && this.summary?.currentPrice?.priceId === price.priceId;
  }

  isSelectedPlanUnavailable(plan: BillingPlan): boolean {
    const price = this.selectedPriceFor(plan);
    return !price?.priceId || !price.checkoutEnabled;
  }

  planActionLabel(plan: BillingPlan, price: BillingPriceOption | null | undefined): string {
    if (!price?.priceId || !price.checkoutEnabled) {
      return this.i18nService.t("billing.not_available");
    }

    if (this.isCurrentPrice(price)) {
      return this.i18nService.t("common.current");
    }

    if (this.isCurrentPlan(plan)) {
      return this.i18nService.t("billing.change_plan");
    }

    return this.i18nService.t("billing.choose_plan");
  }

  trackPlanPrice(_index: number, price: BillingPriceOption): string {
    return `${price.interval}:${price.priceId ?? "unconfigured"}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return "--";
    }

    return new Date(value).toLocaleDateString(this.i18nService.locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  planStatusLabel(): string {
    const status = this.summary?.status;
    if (!status) {
      return "--";
    }

    return this.i18nService.t(`billing.status.${status}`);
  }

  async startCheckout(price: BillingPriceOption): Promise<void> {
    if (!this.isAdminBilling || !price.priceId || !price.checkoutEnabled) {
      return;
    }

    this.actionLoading = true;
    try {
      const session = await this.billingService.createCheckoutSession(price.priceId);
      window.location.href = session.url;
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.checkout_failed"), "danger");
    } finally {
      this.actionLoading = false;
    }
  }

  async openPortal(): Promise<void> {
    if (!this.isAdminBilling) {
      return;
    }

    this.actionLoading = true;
    try {
      const session = await this.billingService.createPortalSession();
      window.location.href = session.url;
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.portal_failed"), "danger");
    } finally {
      this.actionLoading = false;
    }
  }

  async loadOverview(): Promise<void> {
    this.loading = true;
    try {
      const overview = await this.billingService.getOverview();
      this.plans = overview.plans;
      this.summary = overview.summary;
      this.selectedInterval = overview.summary?.currentPrice?.interval ?? "month";
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.load_failed"), "danger");
    } finally {
      this.loading = false;
    }
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      color,
      position: "bottom"
    });

    await toast.present();
  }
}

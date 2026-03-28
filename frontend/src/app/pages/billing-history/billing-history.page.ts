import { Component, OnDestroy } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { BillingAccountPaymentsView, BillingPaymentRecord, BillingPaymentsHistoryResponse } from "src/app/core/models/types";
import { AuthService } from "src/app/core/services/auth.service";
import { BillingService } from "src/app/core/services/billing.service";
import { I18nService } from "src/app/core/services/i18n.service";

@Component({
  selector: "app-billing-history",
  templateUrl: "./billing-history.page.html",
  styleUrls: ["./billing-history.page.scss"],
  standalone: false
})
export class BillingHistoryPage implements OnDestroy {
  private paymentsSearchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private historyRequestId = 0;

  history: BillingPaymentsHistoryResponse | null = null;
  loading = false;
  paymentsSearch = "";
  paymentsPage = 1;
  readonly paymentsPageSize = 6;

  constructor(
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    private readonly billingService: BillingService,
    private readonly toastController: ToastController
  ) {}

  ngOnDestroy(): void {
    if (this.paymentsSearchDebounceHandle) {
      clearTimeout(this.paymentsSearchDebounceHandle);
    }
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadHistory();
  }

  get accounts(): BillingAccountPaymentsView[] {
    return this.history?.accounts ?? [];
  }

  get isSuperadminUser(): boolean {
    return this.authService.user?.role === "SUPERADMIN";
  }

  get paymentsTotal(): number {
    return this.history?.total ?? 0;
  }

  get paymentsCurrentPage(): number {
    return this.history?.page ?? this.paymentsPage;
  }

  get paymentsCurrentPageSize(): number {
    return this.history?.pageSize ?? this.paymentsPageSize;
  }

  get paymentsPageCount(): number {
    return Math.max(1, Math.ceil(this.paymentsTotal / this.paymentsCurrentPageSize));
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

  formatMoney(amount: number | null | undefined, currency: string | null | undefined = "EUR"): string {
    if (typeof amount !== "number") {
      return "--";
    }

    return new Intl.NumberFormat(this.i18nService.locale, {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  paymentStatusColor(status: string): "success" | "warning" | "danger" | "medium" {
    if (status === "paid") {
      return "success";
    }

    if (status === "open" || status === "draft") {
      return "warning";
    }

    if (status === "uncollectible" || status === "void") {
      return "danger";
    }

    return "medium";
  }

  subscriptionStatusColor(status: string): "success" | "warning" | "danger" | "medium" {
    if (status === "ACTIVE" || status === "BYPASSED") {
      return "success";
    }

    if (status === "TRIALING" || status === "INCOMPLETE") {
      return "warning";
    }

    if (status === "PAST_DUE" || status === "UNPAID" || status === "CANCELED" || status === "INCOMPLETE_EXPIRED") {
      return "danger";
    }

    return "medium";
  }

  planLabel(account: BillingAccountPaymentsView): string {
    if (account.subscription.isTrial) {
      return this.i18nService.t("billing.status.TRIALING");
    }

    return account.subscription.planCode.replace("PACK_", "Pack ");
  }

  invoicePrimaryLink(payment: BillingPaymentRecord): string | null {
    return payment.hostedInvoiceUrl ?? payment.invoicePdfUrl ?? null;
  }

  onPaymentsSearchChange(): void {
    if (this.paymentsSearchDebounceHandle) {
      clearTimeout(this.paymentsSearchDebounceHandle);
    }

    this.paymentsSearchDebounceHandle = setTimeout(() => {
      this.paymentsPage = 1;
      void this.loadHistory();
    }, 250);
  }

  async goToPaymentsPage(page: number): Promise<void> {
    if (!this.isSuperadminUser || page < 1 || page > this.paymentsPageCount || page === this.paymentsCurrentPage) {
      return;
    }

    this.paymentsPage = page;
    await this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    const requestId = ++this.historyRequestId;
    this.loading = true;
    try {
      const history = await this.billingService.getPaymentsHistory(
        this.isSuperadminUser
          ? {
              page: this.paymentsPage,
              pageSize: this.paymentsPageSize,
              search: this.paymentsSearch
            }
          : undefined
      );

      if (requestId !== this.historyRequestId) {
        return;
      }

      if (this.isSuperadminUser && this.paymentsPage > 1 && history.accounts.length === 0 && history.total > 0) {
        this.paymentsPage -= 1;
        await this.loadHistory();
        return;
      }

      this.history = history;
      this.paymentsPage = history.page;
    } catch (error) {
      if (requestId !== this.historyRequestId) {
        return;
      }

      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing_history.load_failed"), "danger");
    } finally {
      if (requestId === this.historyRequestId) {
        this.loading = false;
      }
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

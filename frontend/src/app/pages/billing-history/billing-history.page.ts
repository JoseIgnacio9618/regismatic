import { Component, OnInit } from "@angular/core";
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
export class BillingHistoryPage implements OnInit {
  history: BillingPaymentsHistoryResponse | null = null;
  loading = false;

  constructor(
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    private readonly billingService: BillingService,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  get accounts(): BillingAccountPaymentsView[] {
    return this.history?.accounts ?? [];
  }

  get isSuperadminView(): boolean {
    return this.history?.scope === "SUPERADMIN";
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

  async loadHistory(): Promise<void> {
    this.loading = true;
    try {
      this.history = await this.billingService.getPaymentsHistory();
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing_history.load_failed"), "danger");
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

import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AlertController, ToastController } from "@ionic/angular";
import {
  AdminSeatLimitControl,
  BillingAdminSeatLimitStats,
  BillingInterval,
  BillingPlan,
  BillingPriceOption,
  BillingSubscriptionStatus,
  BillingSummary
} from "src/app/core/models/types";
import { AuthService } from "src/app/core/services/auth.service";
import { BillingService } from "src/app/core/services/billing.service";
import { I18nService } from "src/app/core/services/i18n.service";

@Component({
  selector: "app-billing",
  templateUrl: "./billing.page.html",
  styleUrls: ["./billing.page.scss"],
  standalone: false
})
export class BillingPage implements OnDestroy, OnInit {
  private readonly activeBillingStatuses = new Set<BillingSubscriptionStatus>(["TRIALING", "ACTIVE"]);
  private hasInitializedInterval = false;
  private adminSearchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private adminSeatControlsRequestId = 0;
  private checkoutQueryHandled = false;

  plans: BillingPlan[] = [];
  summary: BillingSummary | null = null;
  adminSeatControls: AdminSeatLimitControl[] = [];
  adminSeatStats: BillingAdminSeatLimitStats = this.createEmptyAdminSeatStats();
  adminSeatControlsTotal = 0;
  adminSeatControlsPage = 1;
  readonly adminSeatControlsPageSize = 10;
  adminControlsLoading = false;
  loading = false;
  actionLoading = false;
  seatLimitSavingId: string | null = null;
  selectedInterval: BillingInterval = "month";
  adminSearch = "";
  planReferenceModalOpen = false;
  customSeatLimitDrafts: Record<string, string> = {};
  limitEditorOpen = false;
  limitEditorControl: AdminSeatLimitControl | null = null;
  limitEditorPreset = "";
  checkoutFeedbackModalOpen = false;
  checkoutFeedbackStatus: "success" | "cancel" | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    private readonly billingService: BillingService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    const checkout = this.route.snapshot.queryParamMap.get("checkout");
    if (checkout === "success" || checkout === "cancel") {
      this.checkoutFeedbackStatus = checkout;
      this.checkoutFeedbackModalOpen = true;
      this.checkoutQueryHandled = true;
    }
  }

  ngOnDestroy(): void {
    if (this.adminSearchDebounceHandle) {
      clearTimeout(this.adminSearchDebounceHandle);
    }
  }

  openPlanReferenceModal(): void {
    this.planReferenceModalOpen = true;
  }

  closePlanReferenceModal(): void {
    this.planReferenceModalOpen = false;
  }

  closeCheckoutFeedbackModal(): void {
    this.checkoutFeedbackModalOpen = false;
    this.checkoutFeedbackStatus = null;
    if (this.checkoutQueryHandled) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { checkout: null },
        queryParamsHandling: "merge",
        replaceUrl: true
      });
      this.checkoutQueryHandled = false;
    }
  }

  checkoutFeedbackTitle(): string {
    if (this.checkoutFeedbackStatus === "success") {
      return this.i18nService.t("billing.checkout_success_title");
    }

    return this.i18nService.t("billing.checkout_cancel_title");
  }

  checkoutFeedbackMessage(): string {
    if (this.checkoutFeedbackStatus === "success") {
      return this.i18nService.t("billing.checkout_success_message");
    }

    return this.i18nService.t("billing.checkout_cancel_message");
  }

  checkoutFeedbackButtonLabel(): string {
    if (this.checkoutFeedbackStatus === "success") {
      return this.i18nService.t("billing.checkout_success_cta");
    }

    return this.i18nService.t("common.close");
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadOverview();
  }

  get paidPlans(): BillingPlan[] {
    return this.plans.filter((plan) => !plan.isDemo);
  }

  get isAdminBilling(): boolean {
    return this.authService.user?.role === "ADMIN";
  }

  get isSuperadminBilling(): boolean {
    return this.authService.user?.role === "SUPERADMIN";
  }

  get totalAdmins(): number {
    return this.adminSeatStats.totalAdmins;
  }

  get totalManagedSeatsUsed(): number {
    return this.adminSeatStats.totalManagedSeatsUsed;
  }

  get totalManagedSeatsLimit(): number {
    return this.adminSeatStats.totalManagedSeatsLimit;
  }

  get totalManualOverrides(): number {
    return this.adminSeatStats.totalManualOverrides;
  }

  get totalAttentionAdmins(): number {
    return this.adminSeatStats.totalAttentionAdmins;
  }

  get adminSeatControlsPageCount(): number {
    return Math.max(1, Math.ceil(this.adminSeatControlsTotal / this.adminSeatControlsPageSize));
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

  private hasLockedCurrentPaidPlan(): boolean {
    if (!this.summary || this.summary.isTrial) {
      return false;
    }

    return this.activeBillingStatuses.has(this.summary.status as BillingSubscriptionStatus);
  }

  isCurrentPlan(plan: BillingPlan): boolean {
    return this.hasLockedCurrentPaidPlan() && this.summary?.plan.code === plan.code;
  }

  isCurrentPrice(price: BillingPriceOption | null | undefined): boolean {
    return this.hasLockedCurrentPaidPlan() && !!price?.priceId && this.summary?.currentPrice?.priceId === price.priceId;
  }

  planNameForCode(code: string): string {
    return this.plans.find((plan) => plan.code === code)?.name ?? code;
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

  billingPeriodTitle(billing: BillingSummary): string {
    if (billing.isTrial) {
      return this.i18nService.t("billing.trial_ends");
    }

    return billing.cancelAtPeriodEnd
      ? this.i18nService.t("billing.access_until")
      : this.i18nService.t("billing.period_ends");
  }

  billingPeriodHelpText(billing: BillingSummary): string | null {
    const referenceDate = billing.isTrial ? billing.trialEndsAt : billing.currentPeriodEnd;
    if (!referenceDate) {
      return null;
    }

    const diffDays = this.getDaysUntil(referenceDate);
    const formattedDate = this.formatDate(referenceDate);

    if (diffDays <= 0) {
      return this.i18nService.t("billing.remaining_today", { date: formattedDate });
    }

    if (diffDays === 1) {
      return this.i18nService.t("billing.remaining_one_day", { date: formattedDate });
    }

    return this.i18nService.t("billing.remaining_days", {
      days: diffDays,
      date: formattedDate
    });
  }

  canCancelSubscription(billing: BillingSummary | null | undefined): boolean {
    return Boolean(this.isAdminBilling && billing?.managementUrls.cancelAvailable);
  }

  canReactivateSubscription(billing: BillingSummary | null | undefined): boolean {
    return Boolean(this.isAdminBilling && billing?.managementUrls.reactivateAvailable);
  }

  billingPeriodValueText(billing: BillingSummary): string {
    const referenceDate = billing.isTrial ? billing.trialEndsAt : billing.currentPeriodEnd;
    if (!referenceDate) {
      return this.i18nService.t("billing.period_pending_sync");
    }

    return this.formatDate(referenceDate);
  }

  planStatusLabel(): string {
    const status = this.summary?.status;
    if (!status) {
      return "--";
    }

    return this.i18nService.t(`billing.status.${status}`);
  }

  seatLimitSourceLabel(billing: BillingSummary | AdminSeatLimitControl["billing"]): string {
    return this.i18nService.t(`billing.limit_source.${billing.seatLimitSource}`);
  }

  seatLimitSourceHint(billing: BillingSummary | AdminSeatLimitControl["billing"]): string {
    if (billing.seatLimitSource === "CUSTOM") {
      return this.i18nService.t("billing.limit_source_custom_desc");
    }

    if (billing.seatLimitSource === "BYPASSED") {
      return this.i18nService.t("billing.superadmin_desc");
    }

    return this.i18nService.t("billing.limit_source_subscription_desc");
  }

  trialOrPeriodLabel(control: AdminSeatLimitControl): string {
    if (control.billing.isTrial) {
      return this.formatDate(control.billing.trialEndsAt);
    }

    return this.formatDate(control.billing.currentPeriodEnd);
  }

  private getDaysUntil(value: string): number {
    const target = new Date(value);
    const now = new Date();

    const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
    const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    return Math.ceil((targetUtc - nowUtc) / (1000 * 60 * 60 * 24));
  }

  initialsFor(fullName: string): string {
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) {
      return "?";
    }

    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }

  subscriptionStatusColor(status: BillingSubscriptionStatus): "danger" | "medium" | "success" | "warning" {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "TRIALING":
        return "warning";
      case "CANCELED":
      case "INCOMPLETE_EXPIRED":
        return "medium";
      case "PAST_DUE":
      case "INCOMPLETE":
      case "UNPAID":
      default:
        return "danger";
    }
  }

  isOverCapacity(control: AdminSeatLimitControl): boolean {
    return control.seatUsage.used > control.seatUsage.limit;
  }

  isAtCapacity(control: AdminSeatLimitControl): boolean {
    return control.seatUsage.used === control.seatUsage.limit;
  }

  isNearCapacity(control: AdminSeatLimitControl): boolean {
    if (control.seatUsage.limit <= 0 || this.isAtCapacity(control) || this.isOverCapacity(control)) {
      return false;
    }

    return control.seatUsage.used / control.seatUsage.limit >= 0.9;
  }

  seatUsagePercent(control: AdminSeatLimitControl): number {
    if (control.seatUsage.limit <= 0) {
      return 0;
    }

    const percentage = Math.round((control.seatUsage.used / control.seatUsage.limit) * 100);
    if (control.seatUsage.used === 0) {
      return 0;
    }

    return Math.min(100, Math.max(8, percentage));
  }

  isBillingHealthy(control: AdminSeatLimitControl): boolean {
    return control.billing.seatLimitSource === "CUSTOM" || this.activeBillingStatuses.has(control.billing.status);
  }

  isTrialEndingSoon(control: AdminSeatLimitControl): boolean {
    if (!control.billing.isTrial || control.billing.seatLimitSource === "CUSTOM" || !control.billing.trialEndsAt) {
      return false;
    }

    const endsAt = new Date(control.billing.trialEndsAt).getTime();
    const diffDays = Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  }

  controlNeedsAttention(control: AdminSeatLimitControl): boolean {
    if (!this.isBillingHealthy(control)) {
      return true;
    }

    if (this.isOverCapacity(control) || this.isAtCapacity(control) || this.isNearCapacity(control)) {
      return true;
    }

    if (this.isTrialEndingSoon(control)) {
      return true;
    }

    return control.billing.cancelAtPeriodEnd && control.billing.seatLimitSource !== "CUSTOM";
  }

  attentionBadgeColor(control: AdminSeatLimitControl): "danger" | "warning" {
    if (!this.isBillingHealthy(control) || this.isOverCapacity(control) || this.isAtCapacity(control)) {
      return "danger";
    }

    return "warning";
  }

  controlAlertIcon(control: AdminSeatLimitControl): string {
    if (!this.isBillingHealthy(control)) {
      return "alert-circle-outline";
    }

    if (this.isOverCapacity(control) || this.isAtCapacity(control)) {
      return "people-outline";
    }

    if (this.isTrialEndingSoon(control)) {
      return "time-outline";
    }

    return "card-outline";
  }

  controlAttentionTitle(control: AdminSeatLimitControl): string {
    if (!this.isBillingHealthy(control)) {
      return this.i18nService.t("billing.attention_inactive_title");
    }

    if (this.isOverCapacity(control)) {
      return this.i18nService.t("billing.attention_over_capacity_title");
    }

    if (this.isAtCapacity(control)) {
      return this.i18nService.t("billing.attention_capacity_reached_title");
    }

    if (this.isTrialEndingSoon(control)) {
      return this.i18nService.t("billing.attention_trial_ending_title");
    }

    if (control.billing.cancelAtPeriodEnd && control.billing.seatLimitSource !== "CUSTOM") {
      return this.i18nService.t("billing.attention_cancel_pending_title");
    }

    return this.i18nService.t("billing.attention_near_capacity_title");
  }

  controlAttentionDescription(control: AdminSeatLimitControl): string {
    if (!this.isBillingHealthy(control)) {
      return this.i18nService.t("billing.attention_inactive_desc");
    }

    if (this.isOverCapacity(control) || this.isAtCapacity(control) || this.isNearCapacity(control)) {
      return this.i18nService.t("billing.seat_usage_value", {
        used: control.seatUsage.used,
        limit: control.seatUsage.limit,
        remaining: control.seatUsage.remaining
      });
    }

    if (this.isTrialEndingSoon(control)) {
      return `${this.i18nService.t("billing.trial_ends")}: ${this.formatDate(control.billing.trialEndsAt)}`;
    }

    return this.i18nService.t("billing.cancel_pending_desc");
  }

  getCustomSeatLimitDraft(adminId: string, fallback: number | null): string {
    return this.customSeatLimitDrafts[adminId] ?? (fallback !== null ? String(fallback) : "");
  }

  updateCustomSeatLimitDraft(adminId: string, value: string | number | null | undefined): void {
    this.customSeatLimitDrafts[adminId] = typeof value === "number" ? String(value) : String(value ?? "");
  }

  canSaveCustomSeatLimit(control: AdminSeatLimitControl): boolean {
    if (this.seatLimitSavingId === control.admin.id) {
      return false;
    }

    const rawValue = this.getCustomSeatLimitDraft(control.admin.id, control.billing.customSeatLimit).trim();
    if (!rawValue) {
      return false;
    }

    const seatLimit = Number(rawValue);
    if (!Number.isInteger(seatLimit) || seatLimit < 1) {
      return false;
    }

    if (seatLimit === control.billing.subscriptionSeatLimit) {
      return false;
    }

    return rawValue !== (control.billing.customSeatLimit !== null ? String(control.billing.customSeatLimit) : "");
  }

  canRemoveCustomSeatLimit(control: AdminSeatLimitControl): boolean {
    return this.seatLimitSavingId !== control.admin.id && control.billing.customSeatLimit !== null;
  }

  limitPresetOptions(control: AdminSeatLimitControl | null): number[] {
    if (!control) {
      return [];
    }

    const options = new Set<number>();
    this.paidPlans.forEach((plan) => options.add(plan.seatLimit));
    options.add(control.billing.subscriptionSeatLimit);
    if (control.billing.customSeatLimit !== null) {
      options.add(control.billing.customSeatLimit);
    }

    return Array.from(options)
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((left, right) => left - right);
  }

  limitPresetValue(limit: number): string {
    return String(limit);
  }

  openLimitEditor(control: AdminSeatLimitControl): void {
    this.limitEditorControl = control;
    this.limitEditorOpen = true;
    this.limitEditorPreset = this.detectLimitPreset(control);
  }

  closeLimitEditor(): void {
    this.limitEditorOpen = false;
    this.limitEditorControl = null;
    this.limitEditorPreset = "";
  }

  setLimitEditorPreset(value: string | number | null | undefined): void {
    if (!this.limitEditorControl) {
      return;
    }

    const normalized = String(value ?? "");
    this.limitEditorPreset = normalized;

    if (normalized && normalized !== "custom") {
      this.updateCustomSeatLimitDraft(this.limitEditorControl.admin.id, normalized);
    }
  }

  onLimitEditorInput(value: string | number | null | undefined): void {
    if (!this.limitEditorControl) {
      return;
    }

    this.limitEditorPreset = "custom";
    this.updateCustomSeatLimitDraft(this.limitEditorControl.admin.id, value);
  }

  async saveCurrentEditorLimit(): Promise<void> {
    if (!this.limitEditorControl) {
      return;
    }

    await this.saveCustomSeatLimit(this.limitEditorControl, true);
  }

  async clearCurrentEditorLimit(): Promise<void> {
    if (!this.limitEditorControl) {
      return;
    }

    await this.clearCustomSeatLimit(this.limitEditorControl, true);
  }

  onAdminSearchChange(): void {
    if (this.adminSearchDebounceHandle) {
      clearTimeout(this.adminSearchDebounceHandle);
    }

    this.adminSearchDebounceHandle = setTimeout(() => {
      this.adminSeatControlsPage = 1;
      this.closeLimitEditor();
      void this.loadAdminSeatControls();
    }, 250);
  }

  async goToAdminSeatControlsPage(page: number): Promise<void> {
    if (page < 1 || page > this.adminSeatControlsPageCount || page === this.adminSeatControlsPage) {
      return;
    }

    this.adminSeatControlsPage = page;
    this.closeLimitEditor();
    await this.loadAdminSeatControls();
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

  async confirmCancelSubscription(): Promise<void> {
    const billing = this.summary;
    if (!billing || !this.canCancelSubscription(billing) || this.actionLoading) {
      return;
    }

    const alert = await this.alertController.create({
      header: this.i18nService.t("billing.cancel_confirm_title"),
      message: this.cancelSubscriptionConfirmMessage(billing),
      buttons: [
        {
          text: this.i18nService.t("common.cancel"),
          role: "cancel"
        },
        {
          text: this.i18nService.t("billing.cancel_confirm_accept"),
          role: "destructive",
          handler: () => {
            void this.cancelSubscription();
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmReactivateSubscription(): Promise<void> {
    const billing = this.summary;
    if (!billing || !this.canReactivateSubscription(billing) || this.actionLoading) {
      return;
    }

    const alert = await this.alertController.create({
      header: this.i18nService.t("billing.reactivate_confirm_title"),
      message: this.i18nService.t("billing.reactivate_confirm_message"),
      buttons: [
        {
          text: this.i18nService.t("common.cancel"),
          role: "cancel"
        },
        {
          text: this.i18nService.t("billing.reactivate_confirm_accept"),
          handler: () => {
            void this.reactivateSubscription();
          }
        }
      ]
    });

    await alert.present();
  }

  async loadOverview(): Promise<void> {
    const adminSeatControlsRequestId = this.isSuperadminBilling ? ++this.adminSeatControlsRequestId : null;
    this.loading = true;
    try {
      const [overview, adminSeatControlsResponse] = await Promise.all([
        this.billingService.getOverview(),
        this.isSuperadminBilling
          ? this.billingService.getAdminSeatLimitControls({
              page: this.adminSeatControlsPage,
              pageSize: this.adminSeatControlsPageSize,
              search: this.adminSearch
            })
          : Promise.resolve(null)
      ]);

      this.plans = overview.plans;
      this.summary = overview.summary;

      if (adminSeatControlsResponse) {
        if (adminSeatControlsRequestId === this.adminSeatControlsRequestId) {
          this.applyAdminSeatControlsResponse(adminSeatControlsResponse);
        }
      } else {
        this.resetAdminSeatControls();
      }

      if (!this.hasInitializedInterval) {
        this.selectedInterval = overview.summary?.currentPrice?.interval ?? "month";
        this.hasInitializedInterval = true;
      }
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.load_failed"), "danger");
    } finally {
      this.loading = false;
    }
  }

  async saveCustomSeatLimit(control: AdminSeatLimitControl, closeEditor = false): Promise<void> {
    const rawValue = this.getCustomSeatLimitDraft(control.admin.id, control.billing.customSeatLimit).trim();
    const seatLimit = Number(rawValue);
    if (!Number.isInteger(seatLimit) || seatLimit < 1) {
      await this.showToast(this.i18nService.t("billing.invalid_custom_limit"), "danger");
      return;
    }

    if (seatLimit === control.billing.subscriptionSeatLimit) {
      return;
    }

    this.seatLimitSavingId = control.admin.id;
    try {
      await this.billingService.setAdminCustomSeatLimit(control.admin.id, seatLimit);
      await this.loadAdminSeatControls();
      if (closeEditor) {
        this.closeLimitEditor();
      }
      await this.showToast(this.i18nService.t("billing.custom_limit_saved"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.custom_limit_failed"), "danger");
    } finally {
      this.seatLimitSavingId = null;
    }
  }

  async clearCustomSeatLimit(control: AdminSeatLimitControl, closeEditor = false): Promise<void> {
    this.seatLimitSavingId = control.admin.id;
    try {
      await this.billingService.clearAdminCustomSeatLimit(control.admin.id);
      await this.loadAdminSeatControls();
      if (closeEditor) {
        this.closeLimitEditor();
      }
      await this.showToast(this.i18nService.t("billing.custom_limit_removed"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.custom_limit_remove_failed"), "danger");
    } finally {
      this.seatLimitSavingId = null;
    }
  }

  private async loadAdminSeatControls(): Promise<void> {
    if (!this.isSuperadminBilling) {
      return;
    }

    const requestId = ++this.adminSeatControlsRequestId;
    this.adminControlsLoading = true;
    try {
      const response = await this.billingService.getAdminSeatLimitControls({
        page: this.adminSeatControlsPage,
        pageSize: this.adminSeatControlsPageSize,
        search: this.adminSearch
      });

      if (requestId !== this.adminSeatControlsRequestId) {
        return;
      }

      if (this.adminSeatControlsPage > 1 && response.admins.length === 0 && response.total > 0) {
        this.adminSeatControlsPage -= 1;
        await this.loadAdminSeatControls();
        return;
      }

      this.applyAdminSeatControlsResponse(response);
    } catch (error) {
      if (requestId !== this.adminSeatControlsRequestId) {
        return;
      }

      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.load_failed"), "danger");
    } finally {
      if (requestId === this.adminSeatControlsRequestId) {
        this.adminControlsLoading = false;
      }
    }
  }

  private applyAdminSeatControlsResponse(response: {
    admins: AdminSeatLimitControl[];
    total: number;
    page: number;
    pageSize: number;
    stats: BillingAdminSeatLimitStats;
  }): void {
    this.adminSeatControls = response.admins;
    this.adminSeatControlsTotal = response.total;
    this.adminSeatControlsPage = response.page;
    this.adminSeatStats = response.stats;

    const nextDrafts = { ...this.customSeatLimitDrafts };
    response.admins.forEach((item) => {
      nextDrafts[item.admin.id] = item.billing.customSeatLimit !== null ? String(item.billing.customSeatLimit) : "";
    });
    this.customSeatLimitDrafts = nextDrafts;

    if (this.limitEditorControl) {
      const refreshed = response.admins.find((item) => item.admin.id === this.limitEditorControl?.admin.id);
      if (!refreshed) {
        this.closeLimitEditor();
      } else {
        this.limitEditorControl = refreshed;
        this.limitEditorPreset = this.detectLimitPreset(refreshed);
      }
    }
  }

  private cancelSubscriptionConfirmMessage(billing: BillingSummary): string {
    if (billing.seatLimitSource === "CUSTOM") {
      return this.i18nService.t("billing.cancel_confirm_message_custom");
    }

    const remaining = this.billingPeriodHelpText(billing);
    if (remaining) {
      return this.i18nService.t("billing.cancel_confirm_message", {
        remaining
      });
    }

    return this.i18nService.t("billing.cancel_confirm_message_no_date");
  }

  private async cancelSubscription(): Promise<void> {
    const billing = this.summary;
    if (!billing || !this.canCancelSubscription(billing)) {
      return;
    }

    this.actionLoading = true;
    try {
      this.summary = await this.billingService.cancelSubscription();
      try {
        await this.authService.refreshCurrentUser();
      } catch {}
      await this.showToast(this.i18nService.t("billing.cancel_success"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.cancel_failed"), "danger");
    } finally {
      this.actionLoading = false;
    }
  }

  private async reactivateSubscription(): Promise<void> {
    const billing = this.summary;
    if (!billing || !this.canReactivateSubscription(billing)) {
      return;
    }

    this.actionLoading = true;
    try {
      this.summary = await this.billingService.reactivateSubscription();
      try {
        await this.authService.refreshCurrentUser();
      } catch {}
      await this.showToast(this.i18nService.t("billing.reactivate_success"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("billing.reactivate_failed"), "danger");
    } finally {
      this.actionLoading = false;
    }
  }

  private detectLimitPreset(control: AdminSeatLimitControl): string {
    const rawValue = this.getCustomSeatLimitDraft(control.admin.id, control.billing.customSeatLimit).trim();
    if (!rawValue) {
      return "";
    }

    const seatLimit = Number(rawValue);
    if (!Number.isInteger(seatLimit)) {
      return "custom";
    }

    return this.limitPresetOptions(control).includes(seatLimit) ? rawValue : "custom";
  }

  private resetAdminSeatControls(): void {
    this.adminSeatControls = [];
    this.adminSeatControlsTotal = 0;
    this.adminSeatStats = this.createEmptyAdminSeatStats();
    this.customSeatLimitDrafts = {};
    this.closeLimitEditor();
  }

  private createEmptyAdminSeatStats(): BillingAdminSeatLimitStats {
    return {
      totalAdmins: 0,
      totalManagedSeatsUsed: 0,
      totalManagedSeatsLimit: 0,
      totalManualOverrides: 0,
      totalAttentionAdmins: 0
    };
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

import { Component, OnDestroy, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { Subscription } from "rxjs";
import { AttendanceService } from "src/app/core/services/attendance.service";
import { BillingService } from "src/app/core/services/billing.service";
import { TeamJoinRequest, TodayStatus } from "src/app/core/models/types";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { UserService } from "src/app/core/services/user.service";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.page.html",
  styleUrls: ["./dashboard.page.scss"],
  standalone: false
})
export class DashboardPage implements OnInit {
  status: TodayStatus | null = null;
  busy = false;
  statusLoading = false;
  loadError: string | null = null;
  joinRequests: TeamJoinRequest[] = [];
  superadminOverview = {
    admins: 0,
    employees: 0,
    pendingJoinRequests: 0,
    pendingEditRequests: 0,
    paidSubscriptions: 0,
    monthlyRecurringRevenueEur: 0
  };
  superadminOverviewLoading = false;
  superadminOverviewError: string | null = null;
  inviteCode = "";
  requestMessage = "";
  joinBusy = false;
  private authSubscription?: Subscription;
  private lastUserId: string | null = null;

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly billingService: BillingService,
    private readonly userService: UserService,
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    this.authSubscription = this.authService.user$.subscribe((user) => {
      if (user?.id === this.lastUserId) {
        return;
      }

      this.lastUserId = user?.id ?? null;
      this.resetDashboardState();

      if (!user) {
        return;
      }

      void this.refreshDashboardData();
    });

    const currentUser = this.authService.user;
    this.lastUserId = currentUser?.id ?? null;
    if (currentUser) {
      await this.refreshDashboardData();
    }
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.authService.user) {
      this.resetDashboardState();
      return;
    }

    await this.refreshDashboardData();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  get showJoinTeamCard(): boolean {
    return this.authService.user?.role === "EMPLOYEE" && !this.authService.user?.managerId;
  }

  get isSuperadminDashboard(): boolean {
    return this.authService.user?.role === "SUPERADMIN";
  }

  get isAttendanceLocked(): boolean {
    return !this.isSuperadminDashboard && this.authService.user?.attendanceAccess?.canRecordAttendance === false;
  }

  get isBillingLocked(): boolean {
    return this.authService.user?.attendanceAccess?.reason === "BILLING_INACTIVE";
  }

  get attendanceDeletionAt(): string | null {
    return this.authService.user?.attendanceAccess?.dataDeletionAt ?? null;
  }

  get attendanceLockDescription(): string {
    if (this.isBillingLocked) {
      return this.authService.isAdmin
        ? this.i18nService.t("dashboard.attendance_billing_locked_admin_desc")
        : this.i18nService.t("dashboard.attendance_billing_locked_employee_desc", {
            admin: this.authService.user?.attendanceAccess?.managedByAdminName ?? this.i18nService.t("role.ADMIN")
          });
    }

    return this.i18nService.t("dashboard.attendance_locked_desc");
  }

  get showBillingCta(): boolean {
    return this.isBillingLocked && this.authService.user?.role === "ADMIN";
  }

  get showDeletionWarning(): boolean {
    return this.isBillingLocked && Boolean(this.attendanceDeletionAt);
  }

  get pendingJoinRequests(): TeamJoinRequest[] {
    return this.joinRequests.filter((request) => request.status === "PENDING");
  }

  get stateLabel(): string {
    if (this.loadError) {
      return this.i18nService.t("dashboard.state.no_connection");
    }

    if (!this.status) {
      return this.i18nService.t("dashboard.state.pending");
    }

    if (this.status.state === "OFF") {
      return this.i18nService.t("dashboard.state.off");
    }

    if (this.status.state === "WORKING") {
      return this.i18nService.t("dashboard.state.working");
    }

    return this.i18nService.t("dashboard.state.on_break");
  }

  get stateColor(): "danger" | "medium" | "success" | "warning" {
    if (this.loadError) {
      return "danger";
    }

    if (!this.status || this.status.state === "OFF") {
      return "medium";
    }

    if (this.status.state === "ON_BREAK") {
      return "warning";
    }

    return "success";
  }

  get effectiveState(): "OFF" | "WORKING" | "ON_BREAK" {
    return this.status?.state ?? "OFF";
  }

  minutesToHuman(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h}h ${m}m`;
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(this.i18nService.locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
  }

  formatDateOnly(iso: string): string {
    return new Date(iso).toLocaleDateString(this.i18nService.locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat(this.i18nService.locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2
    }).format(amount);
  }

  async handleAction(action: "clockIn" | "breakStart" | "breakEnd" | "clockOut"): Promise<void> {
    if (this.isAttendanceLocked) {
      await this.showToast(
        this.i18nService.t(
          this.isBillingLocked ? "errors.attendance_blocked_billing" : "errors.employee_team_assignment_required"
        ),
        "danger"
      );
      return;
    }

    this.busy = true;

    try {
      const coords = await this.getGeolocation();
      if (action === "clockIn") {
        await this.attendanceService.clockIn(coords);
      } else if (action === "breakStart") {
        await this.attendanceService.breakStart(coords);
      } else if (action === "breakEnd") {
        await this.attendanceService.breakEnd(coords);
      } else {
        await this.attendanceService.clockOut(coords);
      }

      await this.refreshStatus();
      await this.showToast(this.i18nService.t("dashboard.toast_event_registered"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("dashboard.toast_event_failed"), "danger");
    } finally {
      this.busy = false;
    }
  }

  async refreshStatus(showErrorToast = false): Promise<void> {
    if (this.isSuperadminDashboard) {
      this.status = null;
      this.loadError = null;
      this.statusLoading = false;
      return;
    }

    if (this.isAttendanceLocked) {
      this.status = null;
      this.loadError = null;
      this.statusLoading = false;
      return;
    }

    this.statusLoading = true;
    this.loadError = null;
    try {
      this.status = await this.attendanceService.getTodayStatus();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : this.i18nService.t("dashboard.error_load_status");
      this.status = null;
      if (showErrorToast) {
        await this.showToast(this.loadError, "danger");
      }
    } finally {
      this.statusLoading = false;
    }
  }

  async refreshJoinRequests(): Promise<void> {
    if (this.authService.user?.role !== "EMPLOYEE") {
      this.joinRequests = [];
      return;
    }

    try {
      this.joinRequests = await this.userService.listAllTeamJoinRequests();
    } catch {
      this.joinRequests = [];
    }
  }

  async submitJoinRequest(): Promise<void> {
    const inviteCode = this.inviteCode.trim();
    if (!inviteCode) {
      await this.showToast(this.i18nService.t("dashboard.join_team_code_required"), "danger");
      return;
    }

    this.joinBusy = true;
    try {
      await this.userService.createTeamJoinRequest({
        inviteCode,
        message: this.requestMessage.trim() || undefined
      });
      this.inviteCode = "";
      this.requestMessage = "";
      await this.refreshJoinRequests();
      await this.showToast(this.i18nService.t("dashboard.join_team_requested"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("dashboard.join_team_failed"), "danger");
    } finally {
      this.joinBusy = false;
    }
  }

  private async getGeolocation(): Promise<{ latitude?: number; longitude?: number }> {
    if (!("geolocation" in navigator)) {
      return {};
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6))
          });
        },
        () => resolve({}),
        { timeout: 6000 }
      );
    });
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2000, color });
    await toast.present();
  }

  private async refreshDashboardData(): Promise<void> {
    if (this.isSuperadminDashboard) {
      await this.refreshSuperadminOverview();
      return;
    }

    await this.refreshStatus();
    await this.refreshJoinRequests();
  }

  private async refreshSuperadminOverview(): Promise<void> {
    this.superadminOverviewLoading = true;
    this.superadminOverviewError = null;

    try {
      const [users, pendingJoinRequests, pendingEditRequests, adminBillingControls] = await Promise.all([
        this.userService.listAllUsers(),
        this.userService.listAllTeamJoinRequests({ status: "PENDING" }),
        this.attendanceService.listAllEditRequests("PENDING"),
        this.billingService.listAllAdminSeatLimitControls()
      ]);

      const paidSubscriptionControls = adminBillingControls.filter((control) => {
        return (
          control.billing.seatLimitSource === "SUBSCRIPTION" &&
          !control.billing.isTrial &&
          control.billing.status === "ACTIVE" &&
          Boolean(control.billing.currentPrice?.amountEur)
        );
      });

      const monthlyRecurringRevenueEur = paidSubscriptionControls.reduce((sum, control) => {
        const price = control.billing.currentPrice;
        if (!price) {
          return sum;
        }

        const impliedMonthlyAmount =
          price.interval === "year" ? (price.monthlyEquivalentEur ?? 0) : (price.amountEur ?? 0);

        return sum + impliedMonthlyAmount;
      }, 0);

      this.superadminOverview = {
        admins: users.filter((user) => user.role === "ADMIN").length,
        employees: users.filter((user) => user.role === "EMPLOYEE").length,
        pendingJoinRequests: pendingJoinRequests.length,
        pendingEditRequests: pendingEditRequests.length,
        paidSubscriptions: paidSubscriptionControls.length,
        monthlyRecurringRevenueEur: Number(monthlyRecurringRevenueEur.toFixed(2))
      };
    } catch (error) {
      this.superadminOverviewError =
        error instanceof Error ? error.message : this.i18nService.t("dashboard.superadmin_overview_error");
    } finally {
      this.superadminOverviewLoading = false;
    }
  }

  private resetDashboardState(): void {
    this.status = null;
    this.loadError = null;
    this.statusLoading = false;
    this.joinRequests = [];
    this.superadminOverview = {
      admins: 0,
      employees: 0,
      pendingJoinRequests: 0,
      pendingEditRequests: 0,
      paidSubscriptions: 0,
      monthlyRecurringRevenueEur: 0
    };
    this.superadminOverviewLoading = false;
    this.superadminOverviewError = null;
    this.inviteCode = "";
    this.requestMessage = "";
    this.joinBusy = false;
  }
}

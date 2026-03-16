import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ToastController } from "@ionic/angular";
import { AttendanceEventRecord, Role, SummaryRow, TeamUser, WorkEventEditRequestRecord } from "src/app/core/models/types";
import { AttendanceService } from "src/app/core/services/attendance.service";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { ReportService } from "src/app/core/services/report.service";
import { UserService } from "src/app/core/services/user.service";

type ReportScopeOption = {
  id: string;
  label: string;
  role?: Role;
};

@Component({
  selector: "app-reports",
  templateUrl: "./reports.page.html",
  styleUrls: ["./reports.page.scss"],
  standalone: false
})
export class ReportsPage implements OnInit {
  from = this.getWeekStart();
  to = new Date().toISOString().slice(0, 10);
  selectedUserId = "";
  users: TeamUser[] = [];
  rows: SummaryRow[] = [];
  events: AttendanceEventRecord[] = [];
  pendingRequests: WorkEventEditRequestRecord[] = [];
  loading = false;

  editingEventId: string | null = null;
  requestingEventId: string | null = null;
  reviewCommentByRequestId: Record<string, string> = {};

  adminEditModel = {
    eventAt: "",
    note: "",
    reason: ""
  };

  requestModel = {
    requestedEventAt: "",
    requestedNote: "",
    reason: ""
  };

  constructor(
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    private readonly reportService: ReportService,
    private readonly userService: UserService,
    private readonly attendanceService: AttendanceService,
    private readonly route: ActivatedRoute,
    private readonly toastController: ToastController
  ) {}

  get scopedFilterUsers(): TeamUser[] {
    if (this.authService.isSuperadmin) {
      return this.users;
    }

    return this.users.filter((user) => user.role === "EMPLOYEE");
  }

  get reportScopeOptions(): ReportScopeOption[] {
    if (!this.authService.isAdmin) {
      return [];
    }

    if (this.authService.isSuperadmin) {
      return [
        { id: "", label: this.i18nService.t("reports.scope_all_platform") },
        ...this.scopedFilterUsers.map((user) => ({
          id: user.id,
          label: `${user.fullName} - ${this.roleLabel(user.role)}`,
          role: user.role
        }))
      ];
    }

    const currentUser = this.authService.user;
    return [
      { id: "", label: this.i18nService.t("reports.scope_all_team") },
      ...(currentUser
        ? [
            {
              id: currentUser.id,
              label: this.i18nService.t("reports.scope_only_self")
            }
          ]
        : []),
      ...this.scopedFilterUsers.map((user) => ({
        id: user.id,
        label: `${user.fullName} - ${this.roleLabel(user.role)}`,
        role: user.role
      }))
    ];
  }

  get scopeTitle(): string {
    if (this.authService.isSuperadmin) {
      return this.i18nService.t("reports.scope_superadmin_title");
    }

    if (this.authService.isAdmin) {
      return this.i18nService.t("reports.scope_admin_title");
    }

    return this.i18nService.t("reports.scope_employee_title");
  }

  get scopeDescription(): string {
    if (this.authService.isSuperadmin) {
      return this.i18nService.t("reports.scope_superadmin_desc");
    }

    if (this.authService.isAdmin) {
      return this.i18nService.t("reports.scope_admin_desc");
    }

    return this.i18nService.t("reports.scope_employee_desc");
  }

  get selectedScopeLabel(): string {
    const option = this.reportScopeOptions.find((entry) => entry.id === this.selectedUserId);

    if (option) {
      return option.label;
    }

    if (this.authService.isSuperadmin) {
      return this.i18nService.t("reports.scope_all_platform");
    }

    if (this.authService.isAdmin) {
      return this.i18nService.t("reports.scope_all_team");
    }

    return this.i18nService.t("reports.scope_only_self");
  }

  get scopeBadgeColor(): "medium" | "primary" | "warning" {
    if (this.authService.isSuperadmin) {
      return "warning";
    }

    if (this.authService.isAdmin) {
      return "primary";
    }

    return "medium";
  }

  async ngOnInit(): Promise<void> {
    if (this.authService.isAdmin) {
      const apiUsers = await this.userService.listUsers();
      this.users = this.authService.isSuperadmin ? apiUsers : apiUsers.filter((user) => user.role === "EMPLOYEE");
    }

    await this.loadReport();
    this.applyInitialFocus();
  }

  minutesToHuman(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h}h ${m}m`;
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(this.i18nService.locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  hasPendingRequest(event: AttendanceEventRecord): boolean {
    return event.editRequests.some((request) => request.status === "PENDING");
  }

  eventTypeLabel(type: string): string {
    return this.i18nService.t(`event_type.${type}`);
  }

  eventSourceLabel(source: string): string {
    return this.i18nService.t(`event_source.${source}`);
  }

  dayStatusLabel(status: "OPEN" | "CLOSED"): string {
    return this.i18nService.t(`day_status.${status}`);
  }

  requestStatusLabel(status: "PENDING" | "APPROVED" | "REJECTED"): string {
    return this.i18nService.t(`request_status.${status}`);
  }

  roleLabel(role: Role): string {
    return this.i18nService.t(`role.${role}`);
  }

  async loadReport(): Promise<void> {
    this.loading = true;

    try {
      await this.loadSummaryRows();
      await this.loadEvents();

      if (this.authService.isAdmin) {
        await this.loadPendingRequests();
      }
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_load_failed"), "danger");
    } finally {
      this.loading = false;
    }
  }

  async downloadExcel(): Promise<void> {
    try {
      const workbook = await this.reportService.downloadExcel(this.from, this.to, this.selectedUserId || undefined);
      const url = URL.createObjectURL(workbook);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `regismatic-${this.from}-${this.to}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_csv_failed"), "danger");
    }
  }

  scrollToIncidents(): void {
    const incidentsPanel = document.getElementById("incidents-panel");
    incidentsPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  startAdminEdit(event: AttendanceEventRecord): void {
    this.editingEventId = event.id;
    this.adminEditModel = {
      eventAt: this.toLocalDateTimeValue(event.eventAt),
      note: event.note ?? "",
      reason: ""
    };
    this.requestingEventId = null;
  }

  cancelAdminEdit(): void {
    this.editingEventId = null;
    this.adminEditModel = { eventAt: "", note: "", reason: "" };
  }

  async saveAdminEdit(event: AttendanceEventRecord): Promise<void> {
    if (!this.adminEditModel.reason.trim()) {
      await this.showToast(this.i18nService.t("reports.toast_reason_admin_required"), "danger");
      return;
    }

    try {
      await this.attendanceService.updateEventAsAdmin(event.id, {
        eventAt: this.localDateTimeToIso(this.adminEditModel.eventAt),
        note: this.adminEditModel.note.trim() ? this.adminEditModel.note.trim() : null,
        reason: this.adminEditModel.reason.trim()
      });

      this.cancelAdminEdit();
      await this.loadReport();
      await this.showToast(this.i18nService.t("reports.toast_record_updated"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_record_update_failed"), "danger");
    }
  }

  startRequestEdit(event: AttendanceEventRecord): void {
    this.requestingEventId = event.id;
    this.requestModel = {
      requestedEventAt: this.toLocalDateTimeValue(event.eventAt),
      requestedNote: event.note ?? "",
      reason: ""
    };
    this.editingEventId = null;
  }

  cancelRequestEdit(): void {
    this.requestingEventId = null;
    this.requestModel = { requestedEventAt: "", requestedNote: "", reason: "" };
  }

  async submitRequest(event: AttendanceEventRecord): Promise<void> {
    if (!this.requestModel.reason.trim()) {
      await this.showToast(this.i18nService.t("reports.toast_reason_request_required"), "danger");
      return;
    }

    try {
      await this.attendanceService.createEditRequest(event.id, {
        requestedEventAt: this.localDateTimeToIso(this.requestModel.requestedEventAt),
        requestedNote: this.requestModel.requestedNote.trim() ? this.requestModel.requestedNote.trim() : null,
        reason: this.requestModel.reason.trim()
      });

      this.cancelRequestEdit();
      await this.loadReport();
      await this.showToast(this.i18nService.t("reports.toast_request_sent"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_request_failed"), "danger");
    }
  }

  async reviewRequest(request: WorkEventEditRequestRecord, action: "APPROVE" | "REJECT"): Promise<void> {
    try {
      const reviewComment = this.reviewCommentByRequestId[request.id]?.trim();
      await this.attendanceService.reviewEditRequest(request.id, action, reviewComment || undefined);

      delete this.reviewCommentByRequestId[request.id];
      await this.loadReport();
      await this.showToast(
        this.i18nService.t(action === "APPROVE" ? "reports.toast_approve_success" : "reports.toast_reject_success"),
        "success"
      );
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_review_failed"), "danger");
    }
  }

  private async loadSummaryRows(): Promise<void> {
    const response = await this.reportService.getSummary(this.from, this.to, this.selectedUserId || undefined);
    this.rows = response.rows;
  }

  private async loadEvents(): Promise<void> {
    const response = await this.attendanceService.listEvents(this.from, this.to, this.selectedUserId || undefined);
    this.events = response.events;
  }

  private async loadPendingRequests(): Promise<void> {
    const response = await this.attendanceService.listEditRequests("PENDING", this.selectedUserId || undefined);
    this.pendingRequests = response.requests;
  }

  private toLocalDateTimeValue(iso: string): string {
    const date = new Date(iso);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  private localDateTimeToIso(localDateTime: string): string {
    const parsed = new Date(localDateTime);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(this.i18nService.t("reports.error_invalid_datetime"));
    }
    return parsed.toISOString();
  }

  private getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    now.setDate(now.getDate() - diff);
    return now.toISOString().slice(0, 10);
  }

  private applyInitialFocus(): void {
    const focus = this.route.snapshot.queryParamMap.get("focus");
    if (focus === "incidents" && this.authService.isAdmin) {
      setTimeout(() => this.scrollToIncidents(), 120);
    }
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2400, color });
    await toast.present();
  }
}


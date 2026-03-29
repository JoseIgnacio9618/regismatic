import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ToastController } from "@ionic/angular";
import { Subscription } from "rxjs";
import {
  AttendanceEventRecord,
  Role,
  SummaryRow,
  TeamJoinRequest,
  TeamUser,
  WorkEventEditRequestRecord
} from "src/app/core/models/types";
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

type SuperadminAdminOverview = {
  admin: TeamUser;
  employees: TeamUser[];
  pendingEditRequestsCount: number;
  employeesWithPendingEditsCount: number;
  pendingJoinRequestsCount: number;
  totalActiveItems: number;
};

@Component({
  selector: "app-reports",
  templateUrl: "./reports.page.html",
  styleUrls: ["./reports.page.scss"],
  standalone: false
})
export class ReportsPage implements OnInit, OnDestroy {
  from = this.getWeekStart();
  to = new Date().toISOString().slice(0, 10);
  selectedUserId = "";
  selectedManagerId = "";
  superadminAdminSearch = "";
  users: TeamUser[] = [];
  rows: SummaryRow[] = [];
  events: AttendanceEventRecord[] = [];
  pendingRequests: WorkEventEditRequestRecord[] = [];
  superadminPendingRequestsPool: WorkEventEditRequestRecord[] = [];
  superadminJoinRequests: TeamJoinRequest[] = [];
  loading = false;
  summaryPage = 1;
  eventsPage = 1;
  pendingRequestsPage = 1;
  superadminAdminPage = 1;
  readonly pageSize = 50;
  readonly pendingPageSize = 20;
  readonly superadminAdminPageSize = 6;
  summaryTotal = 0;
  eventsTotal = 0;
  pendingRequestsTotal = 0;

  editingEventId: string | null = null;
  requestingEventId: string | null = null;
  reviewCommentByRequestId: Record<string, string> = {};
  joinReviewCommentByRequestId: Record<string, string> = {};

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
  private authSubscription?: Subscription;
  private lastUserId: string | null = null;

  constructor(
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    private readonly reportService: ReportService,
    private readonly userService: UserService,
    private readonly attendanceService: AttendanceService,
    private readonly route: ActivatedRoute,
    private readonly toastController: ToastController
  ) {}

  get isSuperadminView(): boolean {
    return this.authService.isSuperadmin;
  }

  get isStandardAdminView(): boolean {
    return this.authService.isAdmin && !this.authService.isSuperadmin;
  }

  get adminUsers(): TeamUser[] {
    return this.users.filter((user) => user.role === "ADMIN");
  }

  get employeeUsers(): TeamUser[] {
    return this.users.filter((user) => user.role === "EMPLOYEE");
  }

  get scopedFilterUsers(): TeamUser[] {
    return this.isStandardAdminView ? this.employeeUsers : [];
  }

  get reportScopeOptions(): ReportScopeOption[] {
    if (!this.isStandardAdminView) {
      return [];
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
    if (this.isSuperadminView) {
      return this.i18nService.t("reports.scope_superadmin_title");
    }

    if (this.isStandardAdminView) {
      return this.i18nService.t("reports.scope_admin_title");
    }

    return this.i18nService.t("reports.scope_employee_title");
  }

  get scopeDescription(): string {
    if (this.isSuperadminView) {
      return this.i18nService.t("reports.scope_superadmin_desc");
    }

    if (this.isStandardAdminView) {
      return this.i18nService.t("reports.scope_admin_desc");
    }

    return this.i18nService.t("reports.scope_employee_desc");
  }

  get selectedScopeLabel(): string {
    const option = this.reportScopeOptions.find((entry) => entry.id === this.selectedUserId);

    if (option) {
      return option.label;
    }

    if (this.isStandardAdminView) {
      return this.i18nService.t("reports.scope_all_team");
    }

    return this.i18nService.t("reports.scope_only_self");
  }

  get scopeBadgeColor(): "medium" | "primary" | "warning" {
    if (this.isSuperadminView) {
      return "warning";
    }

    if (this.isStandardAdminView) {
      return "primary";
    }

    return "medium";
  }

  get summaryPageCount(): number {
    return Math.max(1, Math.ceil(this.summaryTotal / this.pageSize));
  }

  get eventsPageCount(): number {
    return Math.max(1, Math.ceil(this.eventsTotal / this.pageSize));
  }

  get pendingRequestsPageCount(): number {
    return Math.max(1, Math.ceil(this.pendingRequestsTotal / this.pendingPageSize));
  }

  get superadminAdminPageCount(): number {
    return Math.max(1, Math.ceil(this.filteredSuperadminAdminOverviews.length / this.superadminAdminPageSize));
  }

  get selectedManagerOverview(): SuperadminAdminOverview | null {
    return this.superadminAdminOverviews.find((overview) => overview.admin.id === this.selectedManagerId) ?? null;
  }

  get selectedManagerEmployees(): TeamUser[] {
    return this.selectedManagerOverview?.employees ?? [];
  }

  get selectedSuperadminEmployee(): TeamUser | null {
    return this.selectedManagerEmployees.find((employee) => employee.id === this.selectedUserId) ?? null;
  }

  get superadminAdminOverviews(): SuperadminAdminOverview[] {
    return this.adminUsers
      .map((admin) => {
        const employees = this.employeeUsers.filter((employee) => employee.manager?.id === admin.id);
        const employeeIds = new Set(employees.map((employee) => employee.id));
        const pendingEditRequests = this.superadminPendingRequestsPool.filter((request) => employeeIds.has(request.workEvent.user.id));
        const pendingJoinRequests = this.superadminJoinRequests.filter((request) => request.targetManager.id === admin.id);

        return {
          admin,
          employees,
          pendingEditRequestsCount: pendingEditRequests.length,
          employeesWithPendingEditsCount: new Set(pendingEditRequests.map((request) => request.workEvent.user.id)).size,
          pendingJoinRequestsCount: pendingJoinRequests.length,
          totalActiveItems: pendingEditRequests.length + pendingJoinRequests.length
        } satisfies SuperadminAdminOverview;
      })
      .sort((left, right) => {
        const byActivity = right.totalActiveItems - left.totalActiveItems;
        if (byActivity !== 0) {
          return byActivity;
        }

        return left.admin.fullName.localeCompare(right.admin.fullName);
      });
  }

  get filteredSuperadminAdminOverviews(): SuperadminAdminOverview[] {
    const term = this.superadminAdminSearch.trim().toLocaleLowerCase();
    if (!term) {
      return this.superadminAdminOverviews;
    }

    return this.superadminAdminOverviews.filter((overview) => {
      const searchable = [overview.admin.fullName, overview.admin.email].join(" ").toLocaleLowerCase();
      return searchable.includes(term);
    });
  }

  get paginatedSuperadminAdminOverviews(): SuperadminAdminOverview[] {
    const start = (this.superadminAdminPage - 1) * this.superadminAdminPageSize;
    return this.filteredSuperadminAdminOverviews.slice(start, start + this.superadminAdminPageSize);
  }

  get filteredSuperadminJoinRequests(): TeamJoinRequest[] {
    if (!this.selectedManagerId) {
      return [];
    }

    const requests = this.superadminJoinRequests.filter((request) => request.targetManager.id === this.selectedManagerId);
    if (!this.selectedUserId) {
      return requests;
    }

    return requests.filter((request) => request.employee.id === this.selectedUserId);
  }

  get canShowDetailedRecords(): boolean {
    return !this.isSuperadminView || Boolean(this.selectedUserId);
  }

  async ngOnInit(): Promise<void> {
    this.authSubscription = this.authService.user$.subscribe((user) => {
      if (user?.id === this.lastUserId) {
        return;
      }

      this.lastUserId = user?.id ?? null;
      this.resetReportState();

      if (!user) {
        return;
      }

      void this.initializeForCurrentUser();
    });

    const currentUser = this.authService.user;
    this.lastUserId = currentUser?.id ?? null;
    if (currentUser) {
      await this.initializeForCurrentUser();
    }
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.authService.user) {
      this.resetReportState();
      return;
    }

    await this.initializeForCurrentUser();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
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

  getEmployeePendingEditCount(userId: string): number {
    return this.superadminPendingRequestsPool.filter((request) => request.workEvent.user.id === userId).length;
  }

  selectSuperadminManager(managerId: string): void {
    if (this.selectedManagerId === managerId) {
      return;
    }

    this.selectedManagerId = managerId;
    this.syncSuperadminAdminPage();
    if (!this.selectedManagerEmployees.some((employee) => employee.id === this.selectedUserId)) {
      this.selectedUserId = "";
    }

    void this.loadReport();
  }

  clearSuperadminManagerSelection(): void {
    this.selectedManagerId = "";
    this.selectedUserId = "";
    this.syncSuperadminAdminPage();
    void this.loadReport();
  }

  onSuperadminAdminSearchChange(value: string | null | undefined): void {
    this.superadminAdminSearch = value ?? "";
    this.superadminAdminPage = 1;
    this.syncSuperadminAdminPage();
  }

  goToSuperadminAdminPage(page: number): void {
    if (page < 1 || page > this.superadminAdminPageCount || page === this.superadminAdminPage) {
      return;
    }

    this.superadminAdminPage = page;
  }

  selectSuperadminEmployee(userId: string): void {
    if (this.selectedUserId === userId) {
      return;
    }

    this.selectedUserId = userId;
    void this.loadReport();
  }

  clearSuperadminEmployeeSelection(): void {
    if (!this.selectedUserId) {
      return;
    }

    this.selectedUserId = "";
    void this.loadReport();
  }

  async loadReport(): Promise<void> {
    this.loading = true;
    this.summaryPage = 1;
    this.eventsPage = 1;
    this.pendingRequestsPage = 1;

    try {
      if (this.isSuperadminView) {
        this.applySuperadminPendingRequestsPage();
        if (!this.selectedUserId) {
          this.clearDetailedData();
          return;
        }

        await Promise.all([this.loadSummaryRows(), this.loadEvents()]);
        return;
      }

      const pendingRequestsPromise = this.isStandardAdminView ? this.loadPendingRequests() : Promise.resolve();
      await Promise.all([this.loadSummaryRows(), this.loadEvents(), pendingRequestsPromise]);
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_load_failed"), "danger");
    } finally {
      this.loading = false;
    }
  }

  async goToSummaryPage(page: number): Promise<void> {
    if (page < 1 || page > this.summaryPageCount || page === this.summaryPage) {
      return;
    }

    this.summaryPage = page;
    try {
      await this.loadSummaryRows();
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_load_failed"), "danger");
    }
  }

  async goToEventsPage(page: number): Promise<void> {
    if (page < 1 || page > this.eventsPageCount || page === this.eventsPage) {
      return;
    }

    this.eventsPage = page;
    try {
      await this.loadEvents();
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_load_failed"), "danger");
    }
  }

  async goToPendingRequestsPage(page: number): Promise<void> {
    if (page < 1 || page > this.pendingRequestsPageCount || page === this.pendingRequestsPage) {
      return;
    }

    this.pendingRequestsPage = page;

    if (this.isSuperadminView) {
      this.applySuperadminPendingRequestsPage();
      return;
    }

    try {
      await this.loadPendingRequests();
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_load_failed"), "danger");
    }
  }

  async downloadExcel(): Promise<void> {
    if (this.isSuperadminView && !this.selectedUserId) {
      await this.showToast(this.i18nService.t("reports.superadmin_export_requires_employee"), "danger");
      return;
    }

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
    if (action === "REJECT" && !this.reviewCommentByRequestId[request.id]?.trim()) {
      await this.showToast(this.i18nService.t("errors.rejection_comment_required"), "danger");
      return;
    }

    try {
      const reviewComment = this.reviewCommentByRequestId[request.id]?.trim();
      await this.attendanceService.reviewEditRequest(request.id, action, reviewComment || undefined);

      delete this.reviewCommentByRequestId[request.id];
      if (this.isSuperadminView) {
        await this.refreshSuperadminCollections();
      }
      await this.loadReport();
      await this.showToast(
        this.i18nService.t(action === "APPROVE" ? "reports.toast_approve_success" : "reports.toast_reject_success"),
        "success"
      );
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_review_failed"), "danger");
    }
  }

  async reviewTeamJoinRequest(request: TeamJoinRequest, action: "APPROVE" | "REJECT"): Promise<void> {
    try {
      const reviewComment = this.joinReviewCommentByRequestId[request.id]?.trim();
      await this.userService.reviewTeamJoinRequest(request.id, {
        action,
        reviewComment: reviewComment || undefined
      });

      delete this.joinReviewCommentByRequestId[request.id];
      this.users = await this.userService.listAllUsers();
      await this.refreshSuperadminCollections();
      await this.loadReport();
      await this.showToast(
        this.i18nService.t(action === "APPROVE" ? "reports.toast_team_join_approve_success" : "reports.toast_team_join_reject_success"),
        "success"
      );
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("reports.toast_review_failed"), "danger");
    }
  }

  private async loadSummaryRows(): Promise<void> {
    const response = await this.reportService.getSummary(this.from, this.to, this.selectedUserId || undefined, this.summaryPage, this.pageSize);
    if (this.summaryPage > 1 && response.rows.length === 0 && response.total > 0) {
      this.summaryPage -= 1;
      await this.loadSummaryRows();
      return;
    }
    this.rows = response.rows;
    this.summaryTotal = response.total;
  }

  private async loadEvents(): Promise<void> {
    const response = await this.attendanceService.listEvents(this.from, this.to, this.selectedUserId || undefined, this.eventsPage, this.pageSize);
    if (this.eventsPage > 1 && response.events.length === 0 && response.total > 0) {
      this.eventsPage -= 1;
      await this.loadEvents();
      return;
    }
    this.events = response.events;
    this.eventsTotal = response.total;
  }

  private async loadPendingRequests(): Promise<void> {
    const response = await this.attendanceService.listEditRequests(
      "PENDING",
      this.selectedUserId || undefined,
      this.pendingRequestsPage,
      this.pendingPageSize
    );
    if (this.pendingRequestsPage > 1 && response.requests.length === 0 && response.total > 0) {
      this.pendingRequestsPage -= 1;
      await this.loadPendingRequests();
      return;
    }
    this.pendingRequests = response.requests;
    this.pendingRequestsTotal = response.total;
  }

  private applySuperadminPendingRequestsPage(): void {
    const filtered = this.superadminPendingRequestsPool.filter((request) => {
      if (!this.selectedManagerId) {
        return false;
      }

      const managerId = this.getUserManagerId(request.workEvent.user.id);
      if (managerId !== this.selectedManagerId) {
        return false;
      }

      if (!this.selectedUserId) {
        return true;
      }

      return request.workEvent.user.id === this.selectedUserId;
    });

    this.pendingRequestsTotal = filtered.length;
    const start = (this.pendingRequestsPage - 1) * this.pendingPageSize;
    this.pendingRequests = filtered.slice(start, start + this.pendingPageSize);
  }

  private getUserManagerId(userId: string): string | null {
    return this.employeeUsers.find((user) => user.id === userId)?.manager?.id ?? null;
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
    if (focus !== "incidents") {
      return;
    }

    if (this.isSuperadminView && !this.selectedManagerId) {
      const firstActiveManager = this.superadminAdminOverviews.find((overview) => overview.totalActiveItems > 0);
      if (firstActiveManager) {
        this.selectedManagerId = firstActiveManager.admin.id;
        this.syncSuperadminSelection();
        this.applySuperadminPendingRequestsPage();
      }
    }

    if (this.authService.isAdmin) {
      setTimeout(() => this.scrollToIncidents(), 120);
    }
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2400, color });
    await toast.present();
  }

  private async initializeForCurrentUser(): Promise<void> {
    if (this.isSuperadminView) {
      this.users = await this.userService.listAllUsers();
      await this.refreshSuperadminCollections();
      await this.loadReport();
      this.applyInitialFocus();
      return;
    }

    if (this.isStandardAdminView) {
      const apiUsers = await this.userService.listAllUsers();
      this.users = apiUsers.filter((user) => user.role === "EMPLOYEE");
    } else {
      this.users = [];
    }

    await this.loadReport();
    this.applyInitialFocus();
  }

  private async refreshSuperadminCollections(): Promise<void> {
    const [pendingRequests, joinRequests] = await Promise.all([
      this.attendanceService.listAllEditRequests("PENDING"),
      this.userService.listAllTeamJoinRequests({ status: "PENDING" })
    ]);

    this.superadminPendingRequestsPool = pendingRequests;
    this.superadminJoinRequests = joinRequests;
    this.syncSuperadminSelection();
    this.applySuperadminPendingRequestsPage();
  }

  private syncSuperadminSelection(): void {
    if (!this.isSuperadminView) {
      return;
    }

    if (this.selectedManagerId && !this.adminUsers.some((user) => user.id === this.selectedManagerId)) {
      this.selectedManagerId = "";
    }

    if (this.selectedUserId && !this.employeeUsers.some((user) => user.id === this.selectedUserId)) {
      this.selectedUserId = "";
    }

    if (this.selectedUserId && !this.selectedManagerId) {
      this.selectedManagerId = this.getUserManagerId(this.selectedUserId) ?? "";
    }

    if (this.selectedUserId && this.getUserManagerId(this.selectedUserId) !== this.selectedManagerId) {
      this.selectedUserId = "";
    }

    this.syncSuperadminAdminPage();
  }

  private syncSuperadminAdminPage(): void {
    const pageCount = this.superadminAdminPageCount;
    if (this.superadminAdminPage > pageCount) {
      this.superadminAdminPage = pageCount;
    }

    if (this.superadminAdminPage < 1) {
      this.superadminAdminPage = 1;
    }

    if (!this.selectedManagerId) {
      return;
    }

    const selectedIndex = this.filteredSuperadminAdminOverviews.findIndex((overview) => overview.admin.id === this.selectedManagerId);
    if (selectedIndex >= 0) {
      this.superadminAdminPage = Math.floor(selectedIndex / this.superadminAdminPageSize) + 1;
    }
  }

  private clearDetailedData(): void {
    this.rows = [];
    this.events = [];
    this.summaryTotal = 0;
    this.eventsTotal = 0;
    this.editingEventId = null;
    this.requestingEventId = null;
  }

  private resetReportState(): void {
    this.selectedUserId = "";
    this.selectedManagerId = "";
    this.superadminAdminSearch = "";
    this.users = [];
    this.rows = [];
    this.events = [];
    this.pendingRequests = [];
    this.superadminPendingRequestsPool = [];
    this.superadminJoinRequests = [];
    this.loading = false;
    this.summaryPage = 1;
    this.eventsPage = 1;
    this.pendingRequestsPage = 1;
    this.superadminAdminPage = 1;
    this.summaryTotal = 0;
    this.eventsTotal = 0;
    this.pendingRequestsTotal = 0;
    this.editingEventId = null;
    this.requestingEventId = null;
    this.reviewCommentByRequestId = {};
    this.joinReviewCommentByRequestId = {};
    this.adminEditModel = {
      eventAt: "",
      note: "",
      reason: ""
    };
    this.requestModel = {
      requestedEventAt: "",
      requestedNote: "",
      reason: ""
    };
  }
}

import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { AlertController, ToastController } from "@ionic/angular";
import { Subscription } from "rxjs";
import { BillingSummary, Role, TeamJoinRequest, TeamUser } from "src/app/core/models/types";
import { ApiService } from "src/app/core/services/api.service";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { UserService } from "src/app/core/services/user.service";

type RoleOption = {
  role: Role;
  titleKey: string;
  descriptionKey: string;
};

type UserSection = {
  key: string;
  title: string;
  description: string;
  users: TeamUser[];
};

type UserWorkspace = "directory" | "create";
type TeamRoleFilter = Role | "ALL";

@Component({
  selector: "app-users",
  templateUrl: "./users.page.html",
  styleUrls: ["./users.page.scss"],
  standalone: false
})
export class UsersPage implements OnInit, OnDestroy {
  @ViewChild("createPhotoInput") createPhotoInput?: ElementRef<HTMLInputElement>;
  @ViewChild("userPhotoInput") userPhotoInput?: ElementRef<HTMLInputElement>;
  private routeSubscription?: Subscription;
  private authSubscription?: Subscription;
  private lastUserId: string | null = null;
  private readonly roleOptions: RoleOption[] = [
    {
      role: "EMPLOYEE",
      titleKey: "users.role_employee_title",
      descriptionKey: "users.role_employee_desc"
    },
    {
      role: "ADMIN",
      titleKey: "users.role_admin_title",
      descriptionKey: "users.role_admin_desc"
    },
    {
      role: "SUPERADMIN",
      titleKey: "users.role_superadmin_title",
      descriptionKey: "users.role_superadmin_desc"
    }
  ];

  users: TeamUser[] = [];
  managerUsers: TeamUser[] = [];
  joinRequests: TeamJoinRequest[] = [];
  activeWorkspace: UserWorkspace = "directory";
  teamSearchTerm = "";
  teamRoleFilter: TeamRoleFilter = "ALL";
  usersPage = 1;
  readonly usersPageSize = 25;
  usersTotal = 0;
  joinRequestsPage = 1;
  readonly joinRequestsPageSize = 10;
  joinRequestsTotal = 0;
  private teamSearchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  fullName = "";
  email = "";
  password = "Regismatic2026!";
  role: Role = "EMPLOYEE";
  managerId = "";
  managerDraftByUserId: Record<string, string> = {};
  deletingUserId: string | null = null;
  savingManagerUserId: string | null = null;
  photoTargetUserId: string | null = null;
  photoLoadingUserId: string | null = null;
  resettingPasswordUserId: string | null = null;
  impersonatingUserId: string | null = null;
  reviewingJoinRequestId: string | null = null;
  photoCropperOpen = false;
  photoCropSourceUrl: string | null = null;
  photoCropMode: "create" | "user" | null = null;
  createPhotoFile: File | null = null;
  createPhotoPreviewUrl: string | null = null;
  photoViewerOpen = false;
  photoViewerUser: TeamUser | null = null;
  photoViewerResolvedUrl: string | null = null;
  managerPickerOpen = false;
  managerPickerUser: TeamUser | null = null;
  managerSearchTerm = "";
  managerPickerResults: TeamUser[] = [];
  managerPickerPage = 1;
  readonly managerPickerPageSize = 8;
  managerPickerTotal = 0;
  private managerSearchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    public readonly authService: AuthService,
    private readonly apiService: ApiService,
    private readonly userService: UserService,
    public readonly i18nService: I18nService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      const workspace = params.get("workspace");
      if (workspace === "create" || workspace === "directory") {
        this.activeWorkspace = workspace;
      }
    });

    this.authSubscription = this.authService.user$.subscribe((user) => {
      if (user?.id === this.lastUserId) {
        return;
      }

      this.lastUserId = user?.id ?? null;
      this.resetUsersState();

      if (!user) {
        return;
      }

      if (!this.authService.isAdmin) {
        return;
      }

      void this.loadUsers();
    });

    const currentUser = this.authService.user;
    this.lastUserId = currentUser?.id ?? null;
    if (currentUser && this.authService.isAdmin) {
      await this.loadUsers();
    }
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.authService.user || !this.authService.isAdmin) {
      this.resetUsersState();
      return;
    }

    await this.loadUsers();
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.authSubscription?.unsubscribe();
    if (this.teamSearchDebounceHandle) {
      clearTimeout(this.teamSearchDebounceHandle);
    }
    if (this.managerSearchDebounceHandle) {
      clearTimeout(this.managerSearchDebounceHandle);
    }
    this.clearCreatePhotoPreview();
    this.clearPhotoCropSource();
    this.clearPhotoViewerResolvedUrl();
  }

  get isSuperadmin(): boolean {
    return this.authService.isSuperadmin;
  }

  get availableManagerUsers(): TeamUser[] {
    return this.managerUsers;
  }

  get effectiveRole(): Role {
    return this.isSuperadmin ? this.role : "EMPLOYEE";
  }

  get needsManagerSelection(): boolean {
    return this.isSuperadmin && this.effectiveRole === "EMPLOYEE";
  }

  get visibleAdminsCount(): number {
    return this.users.filter((user) => user.role === "ADMIN").length;
  }

  get visibleEmployeesCount(): number {
    return this.users.filter((user) => user.role === "EMPLOYEE").length;
  }

  get visibleSuperadminsCount(): number {
    return this.users.filter((user) => user.role === "SUPERADMIN").length;
  }

  get groupedUserSections(): UserSection[] {
    const scopedUsers = this.filteredUsersByCurrentRole;

    if (!this.isSuperadmin) {
      return [
        {
          key: "employees",
          title: this.i18nService.t("users.section_team"),
          description: this.i18nService.t("users.section_team_desc"),
          users: scopedUsers
        }
      ].filter((section) => section.users.length > 0);
    }

    return [
      {
        key: "superadmins",
        title: this.i18nService.t("users.section_superadmins"),
        description: this.i18nService.t("users.section_superadmins_desc"),
        users: scopedUsers.filter((user) => user.role === "SUPERADMIN")
      },
      {
        key: "admins",
        title: this.i18nService.t("users.section_admins"),
        description: this.i18nService.t("users.section_admins_desc"),
        users: scopedUsers.filter((user) => user.role === "ADMIN")
      },
      {
        key: "employees",
        title: this.i18nService.t("users.section_employees"),
        description: this.i18nService.t("users.section_employees_desc"),
        users: scopedUsers.filter((user) => user.role === "EMPLOYEE")
      }
    ].filter((section) => section.users.length > 0);
  }

  get usersByCurrentRole(): TeamUser[] {
    if (this.isSuperadmin) {
      return this.users;
    }

    return this.users.filter((user) => user.role === "EMPLOYEE");
  }

  get filteredUsersByCurrentRole(): TeamUser[] {
    return this.usersByCurrentRole.filter((user) => {
      if (this.teamRoleFilter !== "ALL" && user.role !== this.teamRoleFilter) {
        return false;
      }

      return this.matchesTeamSearch(user);
    });
  }

  get teamRoleFilterOptions(): TeamRoleFilter[] {
    return this.isSuperadmin ? ["ALL", "SUPERADMIN", "ADMIN", "EMPLOYEE"] : ["ALL", "EMPLOYEE"];
  }

  get showTeamRoleFilter(): boolean {
    return this.isSuperadmin;
  }

  get totalFilteredUsers(): number {
    return this.usersTotal;
  }

  get scopeTitle(): string {
    return this.i18nService.t(this.isSuperadmin ? "users.scope_superadmin_title" : "users.scope_admin_title");
  }

  get scopeDescription(): string {
    return this.i18nService.t(this.isSuperadmin ? "users.scope_superadmin_desc" : "users.scope_admin_desc");
  }

  get adminInviteCode(): string | null {
    return this.authService.isAdmin ? this.authService.user?.adminInviteCode ?? null : null;
  }

  get adminBilling(): BillingSummary | null {
    return this.authService.isAdmin ? this.authService.user?.billing ?? null : null;
  }

  get showAdminBillingNotice(): boolean {
    return Boolean(this.adminBilling && !this.isSuperadmin);
  }

  get pendingJoinRequests(): TeamJoinRequest[] {
    return this.joinRequests.filter((request) => request.status === "PENDING");
  }

  get usersPageCount(): number {
    return Math.max(1, Math.ceil(this.usersTotal / this.usersPageSize));
  }

  get joinRequestsPageCount(): number {
    return Math.max(1, Math.ceil(this.joinRequestsTotal / this.joinRequestsPageSize));
  }

  get paginatedManagerUsers(): TeamUser[] {
    return this.managerPickerResults;
  }

  get managerPickerPageCount(): number {
    return Math.max(1, Math.ceil(this.managerPickerTotal / this.managerPickerPageSize));
  }

  get selectedRoleOption(): RoleOption {
    return this.roleOptions.find((option) => option.role === this.role) ?? this.roleOptions[0];
  }

  get createRoleOptions(): RoleOption[] {
    return this.roleOptions;
  }

  onRoleChange(): void {
    if (this.role !== "EMPLOYEE") {
      this.managerId = "";
      return;
    }

    this.managerId = this.managerId || this.availableManagerUsers[0]?.id || "";
  }

  selectRole(role: Role): void {
    this.role = role;
    this.onRoleChange();
  }

  selectWorkspace(workspace: unknown): void {
    if (workspace !== "directory" && workspace !== "create") {
      return;
    }

    this.activeWorkspace = workspace;
  }

  onTeamSearchChange(): void {
    if (this.teamSearchDebounceHandle) {
      clearTimeout(this.teamSearchDebounceHandle);
    }

    this.teamSearchDebounceHandle = setTimeout(() => {
      this.usersPage = 1;
      void this.loadUsers();
    }, 250);
  }

  async onTeamRoleFilterChange(): Promise<void> {
    this.usersPage = 1;
    await this.loadUsers();
  }

  async createUser(): Promise<void> {
    if (this.needsManagerSelection && !this.managerId) {
      await this.showToast(this.i18nService.t("users.toast_manager_required"), "danger");
      return;
    }

    try {
      const createdUser = await this.userService.createUser({
        email: this.email,
        fullName: this.fullName,
        password: this.password,
        role: this.effectiveRole,
        managerId: this.needsManagerSelection ? this.managerId : undefined
      });

      if (this.createPhotoFile) {
        await this.userService.uploadUserProfilePhoto(createdUser.id, this.createPhotoFile);
      }

      this.fullName = "";
      this.email = "";
      this.password = "Regismatic2026!";
      this.role = "EMPLOYEE";
      this.managerId = "";
      this.clearCreatePhoto();

      await this.loadUsers();
      await this.showToast(this.i18nService.t("users.toast_user_created"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("users.toast_user_create_failed"), "danger");
    }
  }

  openCreatePhotoPicker(): void {
    this.createPhotoInput?.nativeElement.click();
  }

  onCreatePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) {
      this.openPhotoCropper(file, "create");
    }
    input.value = "";
  }

  clearCreatePhoto(): void {
    this.createPhotoFile = null;
    this.clearCreatePhotoPreview();
  }

  roleLabel(role: Role): string {
    return this.i18nService.t(`role.${role}`);
  }

  roleFilterLabel(filter: TeamRoleFilter): string {
    return filter === "ALL" ? this.i18nService.t("users.filter_role_all") : this.roleLabel(filter);
  }

  canDeleteUser(user: TeamUser): boolean {
    return this.authService.user?.id !== user.id;
  }

  canResetPassword(user: TeamUser): boolean {
    if (this.isSuperadmin) {
      return user.role !== "SUPERADMIN";
    }

    return user.role === "EMPLOYEE";
  }

  canImpersonateUser(user: TeamUser): boolean {
    return this.isSuperadmin && user.isActive && user.role !== "SUPERADMIN";
  }

  canManagePhoto(user: TeamUser): boolean {
    if (this.isSuperadmin) {
      return true;
    }

    return user.role === "EMPLOYEE";
  }

  canPreviewPhoto(user: TeamUser): boolean {
    return Boolean(user.profilePhotoUrl);
  }

  roleMeta(user: TeamUser): string {
    return `${user.email} | ${this.roleLabel(user.role)}`;
  }

  formatCreatedAt(iso: string): string {
    return new Date(iso).toLocaleDateString(this.i18nService.locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  formatBillingDate(iso: string | null | undefined): string {
    if (!iso) {
      return "--";
    }

    return this.formatCreatedAt(iso);
  }

  roleColor(role: Role): "medium" | "primary" | "warning" {
    if (role === "SUPERADMIN") {
      return "warning";
    }

    if (role === "ADMIN") {
      return "primary";
    }

    return "medium";
  }

  trackSection(_index: number, section: UserSection): string {
    return section.key;
  }

  trackUser(_index: number, user: TeamUser): string {
    return user.id;
  }

  trackJoinRequest(_index: number, request: TeamJoinRequest): string {
    return request.id;
  }

  secondaryMeta(user: TeamUser): string | null {
    if (user.role === "EMPLOYEE" && user.manager) {
      return this.i18nService.t("users.assigned_admin", { name: user.manager.fullName });
    }

    if (user.role !== "EMPLOYEE" && user.managedEmployeesCount > 0) {
      return this.i18nService.t("users.managed_employees", { count: user.managedEmployeesCount });
    }

    return null;
  }

  showAdminCode(user: TeamUser): boolean {
    return this.isSuperadmin && user.role === "ADMIN" && !!user.adminInviteCode;
  }

  managerValueFor(user: TeamUser): string {
    return this.managerDraftByUserId[user.id] ?? user.manager?.id ?? "";
  }

  managerLabelFor(user: TeamUser): string {
    return user.manager?.fullName ?? this.i18nService.t("users.manager_unassigned");
  }

  setManagerDraft(userId: string, managerId: string | null | undefined): void {
    this.managerDraftByUserId[userId] = managerId ?? "";
  }

  async updateManagerAssignment(user: TeamUser, managerId: string | null | undefined): Promise<void> {
    const nextManagerId = managerId ?? "";
    const currentManagerId = user.manager?.id ?? "";

    this.setManagerDraft(user.id, nextManagerId);

    if (!nextManagerId || nextManagerId === currentManagerId || this.savingManagerUserId === user.id) {
      return;
    }

    await this.saveManagerAssignment(user);
  }

  openManagerPicker(user: TeamUser): void {
    if (!this.isSuperadmin || user.role !== "EMPLOYEE") {
      return;
    }

    this.managerPickerUser = user;
    this.managerSearchTerm = "";
    this.managerPickerPage = 1;
    this.managerPickerOpen = true;
    void this.loadManagerPickerResults();
  }

  closeManagerPicker(): void {
    this.managerPickerOpen = false;
    this.managerPickerUser = null;
    this.managerSearchTerm = "";
    this.managerPickerResults = [];
    this.managerPickerPage = 1;
    this.managerPickerTotal = 0;
  }

  onManagerSearchChange(): void {
    if (this.managerSearchDebounceHandle) {
      clearTimeout(this.managerSearchDebounceHandle);
    }

    this.managerSearchDebounceHandle = setTimeout(() => {
      this.managerPickerPage = 1;
      void this.loadManagerPickerResults();
    }, 250);
  }

  async goToManagerPickerPage(page: number): Promise<void> {
    if (page < 1 || page > this.managerPickerPageCount || page === this.managerPickerPage) {
      return;
    }

    this.managerPickerPage = page;
    await this.loadManagerPickerResults();
  }

  isSelectedManager(user: TeamUser, manager: TeamUser): boolean {
    return this.managerValueFor(user) === manager.id;
  }

  async selectManagerForCurrentUser(managerId: string): Promise<void> {
    if (!this.managerPickerUser) {
      return;
    }

    const user = this.managerPickerUser;
    await this.updateManagerAssignment(user, managerId);

    if (this.savingManagerUserId !== user.id) {
      this.closeManagerPicker();
    }
  }

  async saveManagerAssignment(user: TeamUser): Promise<void> {
    const managerId = this.managerValueFor(user);
    if (!managerId) {
      await this.showToast(this.i18nService.t("users.toast_manager_required"), "danger");
      return;
    }

    this.savingManagerUserId = user.id;
    try {
      await this.userService.assignManager(user.id, managerId);
      await this.loadUsers();
      delete this.managerDraftByUserId[user.id];
      await this.showToast(this.i18nService.t("users.toast_assignment_updated"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("users.toast_assignment_failed"), "danger");
    } finally {
      this.savingManagerUserId = null;
    }
  }

  async confirmDeleteUser(user: TeamUser): Promise<void> {
    if (!this.canDeleteUser(user) || this.deletingUserId) {
      return;
    }

    const alert = await this.alertController.create({
      header: this.i18nService.t("users.confirm_delete_title"),
      message: this.i18nService.t("users.confirm_delete_message", { name: user.fullName }),
      buttons: [
        {
          text: this.i18nService.t("common.cancel"),
          role: "cancel"
        },
        {
          text: this.i18nService.t("users.confirm_delete_accept"),
          role: "destructive",
          handler: () => {
            void this.deleteUser(user.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async openPasswordResetPrompt(user: TeamUser): Promise<void> {
    if (!this.canResetPassword(user) || this.resettingPasswordUserId) {
      return;
    }

    const alert = await this.alertController.create({
      header: this.i18nService.t("users.password_reset_title"),
      message: this.i18nService.t("users.password_reset_message", { name: user.fullName }),
      inputs: [
        {
          name: "password",
          type: "password",
          placeholder: this.i18nService.t("users.password_reset_field"),
          attributes: {
            minlength: 10,
            autocomplete: "new-password"
          }
        },
        {
          name: "confirmPassword",
          type: "password",
          placeholder: this.i18nService.t("users.password_reset_confirm_field"),
          attributes: {
            minlength: 10,
            autocomplete: "new-password"
          }
        }
      ],
      buttons: [
        {
          text: this.i18nService.t("common.cancel"),
          role: "cancel"
        },
        {
          text: this.i18nService.t("common.save"),
          handler: (value) => {
            const password = typeof value?.password === "string" ? value.password.trim() : "";
            const confirmPassword = typeof value?.confirmPassword === "string" ? value.confirmPassword.trim() : "";

            if (!password || password !== confirmPassword) {
              void this.showToast(this.i18nService.t("users.password_reset_mismatch"), "danger");
              return false;
            }

            void this.resetUserPassword(user, password);
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmImpersonation(user: TeamUser): Promise<void> {
    if (!this.canImpersonateUser(user) || this.impersonatingUserId) {
      return;
    }

    const alert = await this.alertController.create({
      header: this.i18nService.t("users.impersonation_title"),
      message: this.i18nService.t("users.impersonation_message", { name: user.fullName }),
      buttons: [
        {
          text: this.i18nService.t("common.cancel"),
          role: "cancel"
        },
        {
          text: this.i18nService.t("users.impersonation_accept"),
          handler: () => {
            void this.impersonateUser(user);
          }
        }
      ]
    });

    await alert.present();
  }

  openPhotoPicker(user: TeamUser): void {
    if (!this.canManagePhoto(user)) {
      return;
    }

    this.photoTargetUserId = user.id;
    this.userPhotoInput?.nativeElement.click();
  }

  onUserPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !this.photoTargetUserId) {
      input.value = "";
      return;
    }

    this.openPhotoCropper(file, "user");
    input.value = "";
  }

  async removeUserPhoto(user: TeamUser): Promise<void> {
    this.photoLoadingUserId = user.id;
    try {
      await this.userService.removeUserProfilePhoto(user.id);
      await this.loadUsers();
      await this.authService.refreshCurrentUser();
      await this.showToast(this.i18nService.t("profile.photo_removed"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("profile.photo_remove_failed"), "danger");
    } finally {
      this.photoLoadingUserId = null;
    }
  }

  async openPhotoViewer(user: TeamUser): Promise<void> {
    if (!this.canPreviewPhoto(user)) {
      return;
    }

    this.photoViewerUser = user;
    this.photoViewerOpen = true;
    this.clearPhotoViewerResolvedUrl();

    try {
      this.photoViewerResolvedUrl = await this.apiService.getProtectedAssetObjectUrl(user.profilePhotoUrl);
    } catch {
      this.photoViewerResolvedUrl = null;
    }
  }

  closePhotoViewer(): void {
    this.photoViewerOpen = false;
    this.photoViewerUser = null;
    this.clearPhotoViewerResolvedUrl();
  }

  private matchesTeamSearch(_user: TeamUser): boolean {
    return true;
  }

  async goToUsersPage(page: number): Promise<void> {
    if (page < 1 || page > this.usersPageCount || page === this.usersPage) {
      return;
    }

    this.usersPage = page;
    await this.loadUsers();
  }

  async goToJoinRequestsPage(page: number): Promise<void> {
    if (page < 1 || page > this.joinRequestsPageCount || page === this.joinRequestsPage) {
      return;
    }

    this.joinRequestsPage = page;
    await this.loadUsers();
  }

  private async deleteUser(userId: string): Promise<void> {
    this.deletingUserId = userId;
    try {
      await this.userService.deleteUser(userId);
      await this.loadUsers();
      await this.showToast(this.i18nService.t("users.toast_user_deleted"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("users.toast_user_delete_failed"), "danger");
    } finally {
      this.deletingUserId = null;
    }
  }

  private async resetUserPassword(user: TeamUser, password: string): Promise<void> {
    this.resettingPasswordUserId = user.id;
    try {
      await this.userService.resetUserPassword(user.id, password);
      await this.showToast(this.i18nService.t("users.password_reset_success"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("users.password_reset_failed"), "danger");
    } finally {
      this.resettingPasswordUserId = null;
    }
  }

  private async impersonateUser(user: TeamUser): Promise<void> {
    this.impersonatingUserId = user.id;
    try {
      await this.authService.impersonateAsUser(user.id);
      await this.showToast(this.i18nService.t("users.impersonation_success", { name: user.fullName }), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("users.impersonation_failed"), "danger");
    } finally {
      this.impersonatingUserId = null;
    }
  }

  private clearCreatePhotoPreview(): void {
    if (this.createPhotoPreviewUrl) {
      URL.revokeObjectURL(this.createPhotoPreviewUrl);
      this.createPhotoPreviewUrl = null;
    }
  }

  cancelPhotoCrop(): void {
    const wasUserMode = this.photoCropMode === "user";
    this.photoCropperOpen = false;
    this.photoCropMode = null;
    if (wasUserMode) {
      this.photoTargetUserId = null;
    }
    this.clearPhotoCropSource();
  }

  async applyPhotoCrop(result: { file: File; previewUrl: string }): Promise<void> {
    if (this.photoCropMode === "create") {
      this.clearCreatePhotoPreview();
      this.createPhotoFile = result.file;
      this.createPhotoPreviewUrl = result.previewUrl;
      this.photoCropperOpen = false;
      this.photoCropMode = null;
      this.clearPhotoCropSource();
      return;
    }

    const userId = this.photoTargetUserId;
    URL.revokeObjectURL(result.previewUrl);
    this.photoCropperOpen = false;
    this.photoCropMode = null;

    if (!userId) {
      this.clearPhotoCropSource();
      return;
    }

    this.photoLoadingUserId = userId;
    try {
      await this.userService.uploadUserProfilePhoto(userId, result.file);
      await this.loadUsers();
      await this.authService.refreshCurrentUser();
      await this.showToast(this.i18nService.t("profile.photo_updated"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("profile.photo_update_failed"), "danger");
    } finally {
      this.photoLoadingUserId = null;
      this.photoTargetUserId = null;
      this.clearPhotoCropSource();
    }
  }

  private openPhotoCropper(file: File, mode: "create" | "user"): void {
    this.clearPhotoCropSource();
    this.photoCropMode = mode;
    this.photoCropSourceUrl = URL.createObjectURL(file);
    this.photoCropperOpen = true;
  }

  private clearPhotoCropSource(): void {
    if (this.photoCropSourceUrl) {
      URL.revokeObjectURL(this.photoCropSourceUrl);
      this.photoCropSourceUrl = null;
    }
  }

  private clearPhotoViewerResolvedUrl(): void {
    if (this.photoViewerResolvedUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(this.photoViewerResolvedUrl);
    }

    this.photoViewerResolvedUrl = null;
  }

  private async loadUsers(): Promise<void> {
    if (!this.authService.isAdmin) {
      this.resetUsersState();
      return;
    }

    const roleFilter = this.isSuperadmin && this.teamRoleFilter !== "ALL" ? this.teamRoleFilter : undefined;
    const [usersResponse, joinRequestsResponse, managerUsers] = await Promise.all([
      this.userService.listUsers({
        page: this.usersPage,
        pageSize: this.usersPageSize,
        search: this.teamSearchTerm,
        role: roleFilter
      }),
      this.userService.listTeamJoinRequests({
        page: this.joinRequestsPage,
        pageSize: this.joinRequestsPageSize,
        status: "PENDING"
      }),
      this.isSuperadmin ? this.userService.listAllUsers({ role: "ADMIN" }) : Promise.resolve<TeamUser[]>([])
    ]);

    if (this.usersPage > 1 && usersResponse.users.length === 0 && usersResponse.total > 0) {
      this.usersPage -= 1;
      await this.loadUsers();
      return;
    }

    if (this.joinRequestsPage > 1 && joinRequestsResponse.requests.length === 0 && joinRequestsResponse.total > 0) {
      this.joinRequestsPage -= 1;
      await this.loadUsers();
      return;
    }

    this.users = usersResponse.users;
    this.managerUsers = managerUsers;
    this.usersTotal = usersResponse.total;
    this.joinRequests = joinRequestsResponse.requests;
    this.joinRequestsTotal = joinRequestsResponse.total;

    this.managerDraftByUserId = this.users
      .filter((user) => user.role === "EMPLOYEE")
      .reduce<Record<string, string>>((accumulator, user) => {
        accumulator[user.id] = user.manager?.id ?? "";
        return accumulator;
      }, {});

    if (!this.isSuperadmin) {
      this.role = "EMPLOYEE";
      this.managerId = "";
      return;
    }

    if (this.role === "EMPLOYEE" && !this.managerId) {
      this.managerId = this.availableManagerUsers[0]?.id ?? "";
    }
  }

  private async loadManagerPickerResults(): Promise<void> {
    if (!this.isSuperadmin || !this.managerPickerOpen) {
      this.managerPickerResults = [];
      this.managerPickerTotal = 0;
      return;
    }

    const response = await this.userService.listUsers({
      page: this.managerPickerPage,
      pageSize: this.managerPickerPageSize,
      search: this.managerSearchTerm,
      role: "ADMIN"
    });

    if (this.managerPickerPage > 1 && response.users.length === 0 && response.total > 0) {
      this.managerPickerPage -= 1;
      await this.loadManagerPickerResults();
      return;
    }

    this.managerPickerResults = response.users;
    this.managerPickerTotal = response.total;
  }

  async reviewJoinRequest(request: TeamJoinRequest, action: "APPROVE" | "REJECT"): Promise<void> {
    this.reviewingJoinRequestId = request.id;
    try {
      await this.userService.reviewTeamJoinRequest(request.id, { action });
      await this.loadUsers();
      await this.showToast(
        this.i18nService.t(action === "APPROVE" ? "users.join_request_approved" : "users.join_request_rejected"),
        "success"
      );
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("users.join_request_review_failed"), "danger");
    } finally {
      this.reviewingJoinRequestId = null;
    }
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2200, color });
    await toast.present();
  }

  private resetUsersState(): void {
    this.users = [];
    this.managerUsers = [];
    this.joinRequests = [];
    this.teamSearchTerm = "";
    this.teamRoleFilter = "ALL";
    this.usersPage = 1;
    this.usersTotal = 0;
    this.joinRequestsPage = 1;
    this.joinRequestsTotal = 0;
    this.fullName = "";
    this.email = "";
    this.password = "Regismatic2026!";
    this.role = "EMPLOYEE";
    this.managerId = "";
    this.managerDraftByUserId = {};
    this.deletingUserId = null;
    this.savingManagerUserId = null;
    this.photoTargetUserId = null;
    this.photoLoadingUserId = null;
    this.resettingPasswordUserId = null;
    this.reviewingJoinRequestId = null;
    this.managerPickerOpen = false;
    this.managerPickerUser = null;
    this.managerSearchTerm = "";
    this.managerPickerResults = [];
    this.managerPickerPage = 1;
    this.managerPickerTotal = 0;
    this.photoViewerOpen = false;
    this.photoViewerUser = null;
    this.clearPhotoViewerResolvedUrl();
  }
}

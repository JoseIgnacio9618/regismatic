import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { AlertController, ToastController } from "@ionic/angular";
import { Role, TeamUser } from "src/app/core/models/types";
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
  activeWorkspace: UserWorkspace = "directory";
  teamSearchTerm = "";
  teamRoleFilter: TeamRoleFilter = "ALL";

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
  photoCropperOpen = false;
  photoCropSourceUrl: string | null = null;
  photoCropMode: "create" | "user" | null = null;
  createPhotoFile: File | null = null;
  createPhotoPreviewUrl: string | null = null;
  photoViewerOpen = false;
  photoViewerUser: TeamUser | null = null;

  constructor(
    public readonly authService: AuthService,
    private readonly apiService: ApiService,
    private readonly userService: UserService,
    public readonly i18nService: I18nService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  ngOnDestroy(): void {
    this.clearCreatePhotoPreview();
    this.clearPhotoCropSource();
  }

  get isSuperadmin(): boolean {
    return this.authService.isSuperadmin;
  }

  get availableManagerUsers(): TeamUser[] {
    return this.users.filter((user) => user.role === "ADMIN");
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

  get totalFilteredUsers(): number {
    return this.filteredUsersByCurrentRole.length;
  }

  get scopeTitle(): string {
    return this.i18nService.t(this.isSuperadmin ? "users.scope_superadmin_title" : "users.scope_admin_title");
  }

  get scopeDescription(): string {
    return this.i18nService.t(this.isSuperadmin ? "users.scope_superadmin_desc" : "users.scope_admin_desc");
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

  selectWorkspace(workspace: UserWorkspace): void {
    this.activeWorkspace = workspace;
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

  canManagePhoto(user: TeamUser): boolean {
    if (this.isSuperadmin) {
      return true;
    }

    return user.role === "EMPLOYEE";
  }

  canPreviewPhoto(user: TeamUser): boolean {
    return Boolean(user.profilePhotoUrl);
  }

  get selectedPhotoViewerUrl(): string | null {
    return this.apiService.buildAssetUrl(this.photoViewerUser?.profilePhotoUrl);
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

  secondaryMeta(user: TeamUser): string | null {
    if (user.role === "EMPLOYEE" && user.manager) {
      return this.i18nService.t("users.assigned_admin", { name: user.manager.fullName });
    }

    if (user.role !== "EMPLOYEE" && user.managedEmployeesCount > 0) {
      return this.i18nService.t("users.managed_employees", { count: user.managedEmployeesCount });
    }

    return null;
  }

  managerValueFor(user: TeamUser): string {
    return this.managerDraftByUserId[user.id] ?? user.manager?.id ?? "";
  }

  setManagerDraft(userId: string, managerId: string | null | undefined): void {
    this.managerDraftByUserId[userId] = managerId ?? "";
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

  openPhotoViewer(user: TeamUser): void {
    if (!this.canPreviewPhoto(user)) {
      return;
    }

    this.photoViewerUser = user;
    this.photoViewerOpen = true;
  }

  closePhotoViewer(): void {
    this.photoViewerOpen = false;
    this.photoViewerUser = null;
  }

  private matchesTeamSearch(user: TeamUser): boolean {
    const term = this.teamSearchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }

    const managerName = user.manager?.fullName?.toLowerCase() ?? "";
    const haystack = [user.fullName, user.email, this.roleLabel(user.role), managerName].join(" ").toLowerCase();
    return haystack.includes(term);
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

  private async loadUsers(): Promise<void> {
    const apiUsers = await this.userService.listUsers();
    this.users = this.isSuperadmin ? apiUsers : apiUsers.filter((user) => user.role === "EMPLOYEE");

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

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2200, color });
    await toast.present();
  }
}

import { Component, OnInit } from "@angular/core";
import { AlertController, ToastController } from "@ionic/angular";
import { Role, TeamUser } from "src/app/core/models/types";
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

@Component({
  selector: "app-users",
  templateUrl: "./users.page.html",
  styleUrls: ["./users.page.scss"],
  standalone: false
})
export class UsersPage implements OnInit {
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

  fullName = "";
  email = "";
  password = "Regismatic2026!";
  role: Role = "EMPLOYEE";
  managerId = "";
  managerDraftByUserId: Record<string, string> = {};
  deletingUserId: string | null = null;
  savingManagerUserId: string | null = null;

  constructor(
    public readonly authService: AuthService,
    private readonly userService: UserService,
    public readonly i18nService: I18nService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
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
    const scopedUsers = this.usersByCurrentRole;

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

  get scopeTitle(): string {
    return this.i18nService.t(this.isSuperadmin ? "users.scope_superadmin_title" : "users.scope_admin_title");
  }

  get scopeDescription(): string {
    return this.i18nService.t(this.isSuperadmin ? "users.scope_superadmin_desc" : "users.scope_admin_desc");
  }

  get scopeHighlights(): string[] {
    return this.isSuperadmin
      ? [
          this.i18nService.t("users.scope_superadmin_point_one"),
          this.i18nService.t("users.scope_superadmin_point_two"),
          this.i18nService.t("users.scope_superadmin_point_three")
        ]
      : [
          this.i18nService.t("users.scope_admin_point_one"),
          this.i18nService.t("users.scope_admin_point_two"),
          this.i18nService.t("users.scope_admin_point_three")
        ];
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

  async createUser(): Promise<void> {
    if (this.needsManagerSelection && !this.managerId) {
      await this.showToast(this.i18nService.t("users.toast_manager_required"), "danger");
      return;
    }

    try {
      await this.userService.createUser({
        email: this.email,
        fullName: this.fullName,
        password: this.password,
        role: this.effectiveRole,
        managerId: this.needsManagerSelection ? this.managerId : undefined
      });

      this.fullName = "";
      this.email = "";
      this.password = "Regismatic2026!";
      this.role = "EMPLOYEE";
      this.managerId = "";

      await this.loadUsers();
      await this.showToast(this.i18nService.t("users.toast_user_created"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("users.toast_user_create_failed"), "danger");
    }
  }

  roleLabel(role: Role): string {
    return this.i18nService.t(`role.${role}`);
  }

  canDeleteUser(user: TeamUser): boolean {
    return this.authService.user?.id !== user.id;
  }

  roleMeta(user: TeamUser): string {
    return `${user.email} | ${this.roleLabel(user.role)}`;
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

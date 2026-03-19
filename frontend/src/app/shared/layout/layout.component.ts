import { Component, ElementRef, Input, OnDestroy, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { PopoverController, ToastController } from "@ionic/angular";
import type { AppLanguage } from "src/app/core/i18n/translations";
import { UserNotification } from "src/app/core/models/types";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { NotificationService } from "src/app/core/services/notification.service";
import { ThemeService } from "src/app/core/services/theme.service";
import { UserService } from "src/app/core/services/user.service";

@Component({
  selector: "app-main-layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  standalone: false
})
export class LayoutComponent implements OnDestroy {
  private static nextInstanceId = 0;

  @Input() title = "Regismatic";
  @ViewChild("profilePhotoInput") profilePhotoInput?: ElementRef<HTMLInputElement>;
  desktopMenuOpen = false;
  mobileMenuOpen = false;
  photoLoading = false;
  photoCropperOpen = false;
  photoCropSourceUrl: string | null = null;
  readonly desktopTriggerId = `header-actions-trigger-${++LayoutComponent.nextInstanceId}`;
  readonly mobileTriggerId = `header-menu-trigger-${LayoutComponent.nextInstanceId}`;
  readonly desktopNotificationsTriggerId = `header-desktop-notifications-trigger-${LayoutComponent.nextInstanceId}`;
  readonly mobileNotificationsTriggerId = `header-mobile-notifications-trigger-${LayoutComponent.nextInstanceId}`;
  readonly desktopPopoverId = `desktop-menu-popover-${LayoutComponent.nextInstanceId}`;
  readonly mobilePopoverId = `mobile-menu-popover-${LayoutComponent.nextInstanceId}`;
  readonly desktopNotificationsPopoverId = `desktop-notifications-popover-${LayoutComponent.nextInstanceId}`;
  readonly mobileNotificationsPopoverId = `mobile-notifications-popover-${LayoutComponent.nextInstanceId}`;

  constructor(
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    public readonly notificationService: NotificationService,
    public readonly themeService: ThemeService,
    private readonly userService: UserService,
    private readonly popoverController: PopoverController,
    private readonly router: Router,
    private readonly toastController: ToastController
  ) {}

  ngOnDestroy(): void {
    this.clearPhotoCropSource();
  }

  get currentRoleLabel(): string {
    return this.i18nService.t(`role.${this.authService.user?.role ?? "EMPLOYEE"}`);
  }

  get currentScopeHint(): string {
    if (this.authService.isSuperadmin) {
      return this.i18nService.t("layout.scope_superadmin");
    }

    if (this.authService.isAdmin) {
      return this.i18nService.t("layout.scope_admin");
    }

    return this.i18nService.t("layout.scope_employee");
  }

  get currentRoleColor(): "medium" | "primary" | "warning" {
    if (this.authService.isSuperadmin) {
      return "warning";
    }

    if (this.authService.isAdmin) {
      return "primary";
    }

    return "medium";
  }

  go(path: string): void {
    void this.closeMenus();
    void this.router.navigateByUrl(path);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  logout(): void {
    void this.closeMenus();
    this.authService.logout();
  }

  toggleTheme(): void {
    this.themeService.toggle();
    void this.closeMenus();
  }

  setLanguage(language: string | null | undefined): void {
    if (!this.i18nService.isSupportedLanguage(language)) {
      return;
    }

    this.i18nService.setLanguage(language as AppLanguage);
    void this.closeMenus();
  }

  onDesktopMenuDidPresent(): void {
    this.desktopMenuOpen = true;
  }

  onDesktopMenuDidDismiss(): void {
    this.desktopMenuOpen = false;
  }

  onMobileMenuDidPresent(): void {
    this.mobileMenuOpen = true;
  }

  onMobileMenuDidDismiss(): void {
    this.mobileMenuOpen = false;
  }

  formatNotificationDate(iso: string): string {
    return new Date(iso).toLocaleString(this.i18nService.locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async openNotification(notification: UserNotification): Promise<void> {
    await this.notificationService.goToNotification(notification);
    await this.closeMenus();
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.notificationService.markAllAsRead();
  }

  openOwnPhotoPicker(): void {
    this.profilePhotoInput?.nativeElement.click();
  }

  async onOwnPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.clearPhotoCropSource();
    this.photoCropSourceUrl = URL.createObjectURL(file);
    this.photoCropperOpen = true;
    input.value = "";
  }

  async removeOwnPhoto(): Promise<void> {
    this.photoLoading = true;
    try {
      await this.userService.removeOwnProfilePhoto();
      await this.authService.refreshCurrentUser();
      await this.showToast(this.i18nService.t("profile.photo_removed"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("profile.photo_remove_failed"), "danger");
    } finally {
      this.photoLoading = false;
    }
  }

  cancelOwnPhotoCrop(): void {
    this.photoCropperOpen = false;
    this.clearPhotoCropSource();
  }

  async saveOwnCroppedPhoto(result: { file: File; previewUrl: string }): Promise<void> {
    URL.revokeObjectURL(result.previewUrl);
    this.photoLoading = true;
    this.photoCropperOpen = false;

    try {
      await this.userService.uploadOwnProfilePhoto(result.file);
      await this.authService.refreshCurrentUser();
      await this.showToast(this.i18nService.t("profile.photo_updated"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("profile.photo_update_failed"), "danger");
    } finally {
      this.photoLoading = false;
      this.clearPhotoCropSource();
    }
  }

  private async closeMenus(): Promise<void> {
    this.desktopMenuOpen = false;
    this.mobileMenuOpen = false;
    await this.popoverController.dismiss(undefined, undefined, this.desktopPopoverId);
    await this.popoverController.dismiss(undefined, undefined, this.mobilePopoverId);
    await this.popoverController.dismiss(undefined, undefined, this.desktopNotificationsPopoverId);
    await this.popoverController.dismiss(undefined, undefined, this.mobileNotificationsPopoverId);
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2200,
      color,
      position: "bottom"
    });

    await toast.present();
  }

  private clearPhotoCropSource(): void {
    if (this.photoCropSourceUrl) {
      URL.revokeObjectURL(this.photoCropSourceUrl);
      this.photoCropSourceUrl = null;
    }
  }
}

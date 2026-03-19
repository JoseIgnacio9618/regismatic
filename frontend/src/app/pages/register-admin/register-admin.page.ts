import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { ToastController } from "@ionic/angular";
import type { AppLanguage } from "src/app/core/i18n/translations";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { ThemeService } from "src/app/core/services/theme.service";
import { UserService } from "src/app/core/services/user.service";

@Component({
  selector: "app-register-admin",
  templateUrl: "./register-admin.page.html",
  styleUrls: ["./register-admin.page.scss"],
  standalone: false
})
export class RegisterAdminPage implements OnInit, OnDestroy {
  @ViewChild("registerPhotoInput") registerPhotoInput?: ElementRef<HTMLInputElement>;
  fullName = "";
  email = "";
  password = "";
  confirmPassword = "";
  loading = false;
  profilePhotoFile: File | null = null;
  profilePhotoPreviewUrl: string | null = null;
  photoCropperOpen = false;
  photoCropSourceUrl: string | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    public readonly i18nService: I18nService,
    public readonly themeService: ThemeService,
    private readonly router: Router,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    if (this.authService.hasToken) {
      void this.router.navigateByUrl("/dashboard");
    }
  }

  ngOnDestroy(): void {
    this.clearProfilePhotoPreview();
    this.clearPhotoCropSource();
  }

  async submit(): Promise<void> {
    if (this.password !== this.confirmPassword) {
      await this.showError(this.i18nService.t("register_admin.password_mismatch"));
      return;
    }

    this.loading = true;

    try {
      await this.authService.registerAdmin({
        fullName: this.fullName,
        email: this.email,
        password: this.password
      });

      if (this.profilePhotoFile) {
        await this.userService.uploadOwnProfilePhoto(this.profilePhotoFile);
        await this.authService.refreshCurrentUser();
      }

      await this.router.navigateByUrl("/dashboard");
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : this.i18nService.t("register_admin.error_failed"));
    } finally {
      this.loading = false;
    }
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  setLanguage(language: string | null | undefined): void {
    if (!this.i18nService.isSupportedLanguage(language)) {
      return;
    }

    this.i18nService.setLanguage(language as AppLanguage);
  }

  openProfilePhotoPicker(): void {
    this.registerPhotoInput?.nativeElement.click();
  }

  onProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) {
      this.openPhotoCropper(file);
    }
    input.value = "";
  }

  clearProfilePhoto(): void {
    this.profilePhotoFile = null;
    this.clearProfilePhotoPreview();
  }

  cancelPhotoCrop(): void {
    this.photoCropperOpen = false;
    this.clearPhotoCropSource();
  }

  applyPhotoCrop(result: { file: File; previewUrl: string }): void {
    this.clearProfilePhotoPreview();
    this.profilePhotoFile = result.file;
    this.profilePhotoPreviewUrl = result.previewUrl;
    this.photoCropperOpen = false;
    this.clearPhotoCropSource();
  }

  private async showError(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      color: "danger"
    });
    await toast.present();
  }

  private clearProfilePhotoPreview(): void {
    if (this.profilePhotoPreviewUrl) {
      URL.revokeObjectURL(this.profilePhotoPreviewUrl);
      this.profilePhotoPreviewUrl = null;
    }
  }

  private openPhotoCropper(file: File): void {
    this.clearPhotoCropSource();
    this.photoCropSourceUrl = URL.createObjectURL(file);
    this.photoCropperOpen = true;
  }

  private clearPhotoCropSource(): void {
    if (this.photoCropSourceUrl) {
      URL.revokeObjectURL(this.photoCropSourceUrl);
      this.photoCropSourceUrl = null;
    }
  }
}

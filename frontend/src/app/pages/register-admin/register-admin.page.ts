import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { ToastController } from "@ionic/angular";
import type { AppLanguage } from "src/app/core/i18n/translations";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { ThemeService } from "src/app/core/services/theme.service";

@Component({
  selector: "app-register-admin",
  templateUrl: "./register-admin.page.html",
  styleUrls: ["./register-admin.page.scss"],
  standalone: false
})
export class RegisterAdminPage implements OnInit {
  fullName = "";
  email = "";
  password = "";
  confirmPassword = "";
  loading = false;

  constructor(
    private readonly authService: AuthService,
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

  private async showError(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      color: "danger"
    });
    await toast.present();
  }
}

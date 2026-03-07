import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { ToastController } from "@ionic/angular";
import type { AppLanguage } from "src/app/core/i18n/translations";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { ThemeService } from "src/app/core/services/theme.service";

@Component({
  selector: "app-login",
  templateUrl: "./login.page.html",
  styleUrls: ["./login.page.scss"],
  standalone: false
})
export class LoginPage implements OnInit {
  email = "admin@regismatic.local";
  password = "Regismatic2026!";
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
    this.loading = true;

    try {
      await this.authService.login(this.email, this.password);
      await this.router.navigateByUrl("/dashboard");
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : this.i18nService.t("login.error_failed"),
        duration: 2200,
        color: "danger"
      });
      await toast.present();
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
}

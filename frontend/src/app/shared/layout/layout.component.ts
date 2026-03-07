import { Component, Input } from "@angular/core";
import { Router } from "@angular/router";
import type { AppLanguage } from "src/app/core/i18n/translations";
import { AuthService } from "src/app/core/services/auth.service";
import { I18nService } from "src/app/core/services/i18n.service";
import { ThemeService } from "src/app/core/services/theme.service";

@Component({
  selector: "app-main-layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  standalone: false
})
export class LayoutComponent {
  @Input() title = "Regismatic";
  desktopMenuOpen = false;
  mobileMenuOpen = false;

  constructor(
    public readonly authService: AuthService,
    public readonly i18nService: I18nService,
    public readonly themeService: ThemeService,
    private readonly router: Router
  ) {}

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  logout(): void {
    this.authService.logout();
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
}

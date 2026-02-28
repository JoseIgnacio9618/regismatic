import { Component, Input } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "src/app/core/services/auth.service";
import { ThemeService } from "src/app/core/services/theme.service";

@Component({
  selector: "app-main-layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  standalone: false
})
export class LayoutComponent {
  @Input() title = "Regismatic";

  constructor(
    public readonly authService: AuthService,
    public readonly themeService: ThemeService,
    private readonly router: Router
  ) {}

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }

  logout(): void {
    this.authService.logout();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}

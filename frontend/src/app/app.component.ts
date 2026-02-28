import { Component, OnInit } from "@angular/core";
import { AuthService } from "./core/services/auth.service";
import { ThemeService } from "./core/services/theme.service";

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
  styleUrls: ["app.component.scss"],
  standalone: false
})
export class AppComponent implements OnInit {
  constructor(
    private readonly authService: AuthService,
    private readonly themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.init();
    this.authService.bootstrap();
  }
}

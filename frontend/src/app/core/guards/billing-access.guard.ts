import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Injectable({ providedIn: "root" })
export class BillingAccessGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const user = this.authService.user;

    if (!user) {
      return this.authService.hasToken ? true : this.router.parseUrl("/login");
    }

    if (user.role === "SUPERADMIN" || user.attendanceAccess?.reason !== "BILLING_INACTIVE") {
      return true;
    }

    const path = route.routeConfig?.path ?? "";

    if (path === "dashboard") {
      return true;
    }

    if (user.role === "ADMIN" && path === "billing") {
      return true;
    }

    return this.router.parseUrl("/dashboard");
  }
}

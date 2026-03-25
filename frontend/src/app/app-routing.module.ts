import { NgModule } from "@angular/core";
import { PreloadAllModules, RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "./core/guards/auth.guard";
import { AdminGuard } from "./core/guards/admin.guard";
import { BillingAccessGuard } from "./core/guards/billing-access.guard";

const routes: Routes = [
  {
    path: "login",
    loadChildren: () => import("./pages/login/login.module").then((m) => m.LoginPageModule)
  },
  {
    path: "register-admin",
    loadChildren: () => import("./pages/register-admin/register-admin.module").then((m) => m.RegisterAdminPageModule)
  },
  {
    path: "register-employee",
    loadChildren: () => import("./pages/register-employee/register-employee.module").then((m) => m.RegisterEmployeePageModule)
  },
  {
    path: "dashboard",
    canActivate: [AuthGuard, BillingAccessGuard],
    loadChildren: () => import("./pages/dashboard/dashboard.module").then((m) => m.DashboardPageModule)
  },
  {
    path: "reports",
    canActivate: [AuthGuard, BillingAccessGuard],
    loadChildren: () => import("./pages/reports/reports.module").then((m) => m.ReportsPageModule)
  },
  {
    path: "users",
    canActivate: [AuthGuard, AdminGuard, BillingAccessGuard],
    loadChildren: () => import("./pages/users/users.module").then((m) => m.UsersPageModule)
  },
  {
    path: "billing",
    canActivate: [AuthGuard, AdminGuard, BillingAccessGuard],
    loadChildren: () => import("./pages/billing/billing.module").then((m) => m.BillingPageModule)
  },
  {
    path: "billing-history",
    canActivate: [AuthGuard, AdminGuard, BillingAccessGuard],
    loadChildren: () => import("./pages/billing-history/billing-history.module").then((m) => m.BillingHistoryPageModule)
  },
  {
    path: "",
    pathMatch: "full",
    redirectTo: "dashboard"
  },
  {
    path: "**",
    redirectTo: "dashboard"
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}

import { NgModule } from "@angular/core";
import { PreloadAllModules, RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "./core/guards/auth.guard";
import { AdminGuard } from "./core/guards/admin.guard";

const routes: Routes = [
  {
    path: "login",
    loadChildren: () => import("./pages/login/login.module").then((m) => m.LoginPageModule)
  },
  {
    path: "dashboard",
    canActivate: [AuthGuard],
    loadChildren: () => import("./pages/dashboard/dashboard.module").then((m) => m.DashboardPageModule)
  },
  {
    path: "reports",
    canActivate: [AuthGuard],
    loadChildren: () => import("./pages/reports/reports.module").then((m) => m.ReportsPageModule)
  },
  {
    path: "users",
    canActivate: [AuthGuard, AdminGuard],
    loadChildren: () => import("./pages/users/users.module").then((m) => m.UsersPageModule)
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

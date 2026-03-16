import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { RegisterAdminPage } from "./register-admin.page";

const routes: Routes = [
  {
    path: "",
    component: RegisterAdminPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RegisterAdminPageRoutingModule {}

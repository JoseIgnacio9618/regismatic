import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { BillingPage } from "./billing.page";

const routes: Routes = [
  {
    path: "",
    component: BillingPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BillingPageRoutingModule {}

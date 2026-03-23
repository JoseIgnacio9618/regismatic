import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { BillingHistoryPage } from "./billing-history.page";

const routes: Routes = [{ path: "", component: BillingHistoryPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BillingHistoryPageRoutingModule {}

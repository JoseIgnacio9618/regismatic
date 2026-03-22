import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { BillingPageRoutingModule } from "./billing-routing.module";
import { BillingPage } from "./billing.page";
import { SharedModule } from "src/app/shared/shared.module";

@NgModule({
  imports: [CommonModule, IonicModule, BillingPageRoutingModule, SharedModule],
  declarations: [BillingPage]
})
export class BillingPageModule {}

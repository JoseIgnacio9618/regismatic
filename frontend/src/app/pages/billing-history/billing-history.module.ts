import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { SharedModule } from "src/app/shared/shared.module";
import { BillingHistoryPageRoutingModule } from "./billing-history-routing.module";
import { BillingHistoryPage } from "./billing-history.page";

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, BillingHistoryPageRoutingModule],
  declarations: [BillingHistoryPage]
})
export class BillingHistoryPageModule {}

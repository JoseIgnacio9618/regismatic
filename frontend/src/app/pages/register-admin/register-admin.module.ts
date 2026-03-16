import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { RegisterAdminPageRoutingModule } from "./register-admin-routing.module";
import { RegisterAdminPage } from "./register-admin.page";
import { SharedModule } from "src/app/shared/shared.module";

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RegisterAdminPageRoutingModule, SharedModule],
  declarations: [RegisterAdminPage]
})
export class RegisterAdminPageModule {}

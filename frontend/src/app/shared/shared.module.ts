import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { LayoutComponent } from "./layout/layout.component";

@NgModule({
  declarations: [LayoutComponent],
  imports: [CommonModule, IonicModule],
  exports: [LayoutComponent]
})
export class SharedModule {}

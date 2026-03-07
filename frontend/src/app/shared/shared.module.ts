import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { LayoutComponent } from "./layout/layout.component";
import { TPipe } from "./pipes/t.pipe";

@NgModule({
  declarations: [LayoutComponent, TPipe],
  imports: [CommonModule, IonicModule],
  exports: [LayoutComponent, TPipe]
})
export class SharedModule {}

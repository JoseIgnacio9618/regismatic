import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { FormsModule } from "@angular/forms";
import { AvatarComponent } from "./avatar/avatar.component";
import { DateControlComponent } from "./date-control/date-control.component";
import { LayoutComponent } from "./layout/layout.component";
import { PhotoCropperComponent } from "./photo-cropper/photo-cropper.component";
import { TPipe } from "./pipes/t.pipe";
import { DatePickerModule } from "primeng/datepicker";

@NgModule({
  declarations: [AvatarComponent, DateControlComponent, LayoutComponent, PhotoCropperComponent, TPipe],
  imports: [CommonModule, FormsModule, IonicModule, DatePickerModule],
  exports: [AvatarComponent, DateControlComponent, LayoutComponent, PhotoCropperComponent, TPipe]
})
export class SharedModule {}

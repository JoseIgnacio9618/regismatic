import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { FormsModule } from "@angular/forms";
import { AvatarComponent } from "./avatar/avatar.component";
import { LayoutComponent } from "./layout/layout.component";
import { PhotoCropperComponent } from "./photo-cropper/photo-cropper.component";
import { TPipe } from "./pipes/t.pipe";

@NgModule({
  declarations: [AvatarComponent, LayoutComponent, PhotoCropperComponent, TPipe],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [AvatarComponent, LayoutComponent, PhotoCropperComponent, TPipe]
})
export class SharedModule {}

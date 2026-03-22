import { Component, OnInit } from "@angular/core";
import { addIcons } from "ionicons";
import {
  barChartOutline,
  cardOutline,
  cameraOutline,
  checkmarkDoneOutline,
  chevronDownOutline,
  chevronUpOutline,
  cloudOfflineOutline,
  closeOutline,
  informationCircleOutline,
  lockClosedOutline,
  menuOutline,
  moonOutline,
  notificationsOutline,
  peopleOutline,
  searchOutline,
  shieldCheckmarkOutline,
  sunnyOutline,
  timeOutline,
  trashOutline
} from "ionicons/icons";
import { AuthService } from "./core/services/auth.service";
import { I18nService } from "./core/services/i18n.service";
import { RequestLoadingService } from "./core/services/request-loading.service";
import { ThemeService } from "./core/services/theme.service";

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
  styleUrls: ["app.component.scss"],
  standalone: false
})
export class AppComponent implements OnInit {
  private static iconsRegistered = false;

  get loadingMessage(): string {
    return this.i18nService.t("common.loading");
  }

  constructor(
    private readonly authService: AuthService,
    public readonly i18nService: I18nService,
    public readonly requestLoadingService: RequestLoadingService,
    private readonly themeService: ThemeService
  ) {
    if (!AppComponent.iconsRegistered) {
      addIcons({
        "bar-chart-outline": barChartOutline,
        "card-outline": cardOutline,
        "camera-outline": cameraOutline,
        "checkmark-done-outline": checkmarkDoneOutline,
        "chevron-down-outline": chevronDownOutline,
        "chevron-up-outline": chevronUpOutline,
        "cloud-offline-outline": cloudOfflineOutline,
        "close-outline": closeOutline,
        "information-circle-outline": informationCircleOutline,
        "lock-closed-outline": lockClosedOutline,
        "menu-outline": menuOutline,
        "moon-outline": moonOutline,
        "notifications-outline": notificationsOutline,
        "people-outline": peopleOutline,
        "search-outline": searchOutline,
        "shield-checkmark-outline": shieldCheckmarkOutline,
        "sunny-outline": sunnyOutline,
        "time-outline": timeOutline,
        "trash-outline": trashOutline
      });
      AppComponent.iconsRegistered = true;
    }
  }

  ngOnInit(): void {
    this.i18nService.init();
    this.themeService.init();
    this.authService.bootstrap();
  }
}

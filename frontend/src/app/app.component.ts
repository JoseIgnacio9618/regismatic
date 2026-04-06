import { Component, OnInit } from "@angular/core";
import { addIcons } from "ionicons";
import {
  addOutline,
  alertCircleOutline,
  barChartOutline,
  cardOutline,
  cameraOutline,
  checkmarkDoneOutline,
  chevronDownOutline,
  chevronUpOutline,
  cloudOfflineOutline,
  closeOutline,
  documentTextOutline,
  gridOutline,
  informationCircleOutline,
  lockClosedOutline,
  logOutOutline,
  menuOutline,
  moonOutline,
  notificationsOutline,
  peopleOutline,
  personCircleOutline,
  personOutline,
  removeOutline,
  receiptOutline,
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
import { PrimeNG } from "primeng/config";

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
    private readonly themeService: ThemeService,
    private readonly primeNg: PrimeNG
  ) {
    if (!AppComponent.iconsRegistered) {
      addIcons({
        "add-outline": addOutline,
        "alert-circle-outline": alertCircleOutline,
        "bar-chart-outline": barChartOutline,
        "card-outline": cardOutline,
        "camera-outline": cameraOutline,
        "checkmark-done-outline": checkmarkDoneOutline,
        "chevron-down-outline": chevronDownOutline,
        "chevron-up-outline": chevronUpOutline,
        "cloud-offline-outline": cloudOfflineOutline,
        "close-outline": closeOutline,
        "document-text-outline": documentTextOutline,
        "grid-outline": gridOutline,
        "information-circle-outline": informationCircleOutline,
        "lock-closed-outline": lockClosedOutline,
        "log-out-outline": logOutOutline,
        "menu-outline": menuOutline,
        "moon-outline": moonOutline,
        "notifications-outline": notificationsOutline,
        "people-outline": peopleOutline,
        "person-circle-outline": personCircleOutline,
        "person-outline": personOutline,
        "remove-outline": removeOutline,
        "receipt-outline": receiptOutline,
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
    this.syncPrimeDatePickerLocale();
    this.i18nService.language$.subscribe(() => this.syncPrimeDatePickerLocale());
    this.themeService.init();
    this.authService.bootstrap();
  }

  private syncPrimeDatePickerLocale(): void {
    const translationsByLanguage = {
      es: {
        dayNames: ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
        dayNamesShort: ["dom", "lun", "mar", "mie", "jue", "vie", "sab"],
        dayNamesMin: ["D", "L", "M", "X", "J", "V", "S"],
        monthNames: [
          "enero",
          "febrero",
          "marzo",
          "abril",
          "mayo",
          "junio",
          "julio",
          "agosto",
          "septiembre",
          "octubre",
          "noviembre",
          "diciembre"
        ],
        monthNamesShort: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
        today: "Hoy",
        clear: "Limpiar",
        firstDayOfWeek: 1,
        dateFormat: "dd/mm/yy"
      },
      en: {
        dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        dayNamesMin: ["S", "M", "T", "W", "T", "F", "S"],
        monthNames: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December"
        ],
        monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        today: "Today",
        clear: "Clear",
        firstDayOfWeek: 0,
        dateFormat: "mm/dd/yy"
      },
      fr: {
        dayNames: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
        dayNamesShort: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"],
        dayNamesMin: ["D", "L", "M", "M", "J", "V", "S"],
        monthNames: [
          "janvier",
          "fevrier",
          "mars",
          "avril",
          "mai",
          "juin",
          "juillet",
          "aout",
          "septembre",
          "octobre",
          "novembre",
          "decembre"
        ],
        monthNamesShort: ["jan", "fev", "mar", "avr", "mai", "jun", "jul", "aou", "sep", "oct", "nov", "dec"],
        today: "Aujourd'hui",
        clear: "Effacer",
        firstDayOfWeek: 1,
        dateFormat: "dd/mm/yy"
      }
    };

    this.primeNg.setTranslation(translationsByLanguage[this.i18nService.language]);
  }
}

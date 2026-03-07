import { Pipe, PipeTransform } from "@angular/core";
import { I18nService } from "src/app/core/services/i18n.service";
import type { TranslationParams } from "src/app/core/i18n/translations";

@Pipe({
  name: "t",
  pure: false,
  standalone: false
})
export class TPipe implements PipeTransform {
  constructor(private readonly i18nService: I18nService) {}

  transform(key: string | null | undefined, params?: TranslationParams): string {
    if (!key) {
      return "";
    }

    return this.i18nService.t(key, params);
  }
}

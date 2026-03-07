import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import {
  AppLanguage,
  LOCALE_BY_LANGUAGE,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  type TranslationParams
} from "../i18n/translations";

@Injectable({ providedIn: "root" })
export class I18nService {
  private static readonly STORAGE_KEY = "regismatic_lang";
  private readonly languageState = new BehaviorSubject<AppLanguage>("es");
  readonly language$ = this.languageState.asObservable();

  init(): void {
    const stored = localStorage.getItem(I18nService.STORAGE_KEY);
    if (this.isSupportedLanguage(stored)) {
      this.setLanguage(stored);
      return;
    }

    const browserLanguage = navigator.language.toLowerCase();
    if (browserLanguage.startsWith("en")) {
      this.setLanguage("en");
      return;
    }

    if (browserLanguage.startsWith("fr")) {
      this.setLanguage("fr");
      return;
    }

    this.setLanguage("es");
  }

  get language(): AppLanguage {
    return this.languageState.value;
  }

  get locale(): string {
    return LOCALE_BY_LANGUAGE[this.language];
  }

  get supportedLanguages(): AppLanguage[] {
    return SUPPORTED_LANGUAGES;
  }

  setLanguage(language: AppLanguage): void {
    this.languageState.next(language);
    localStorage.setItem(I18nService.STORAGE_KEY, language);
  }

  t(key: string, params?: TranslationParams): string {
    const currentDictionary = TRANSLATIONS[this.language];
    const fallbackDictionary = TRANSLATIONS.es;
    const template = currentDictionary[key] ?? fallbackDictionary[key] ?? key;

    if (!params) {
      return template;
    }

    return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
      return acc.split(`{${paramKey}}`).join(String(paramValue));
    }, template);
  }

  isSupportedLanguage(language: string | null | undefined): language is AppLanguage {
    return language === "es" || language === "en" || language === "fr";
  }
}

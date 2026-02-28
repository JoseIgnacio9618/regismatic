import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";

type ThemeMode = "light" | "dark";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private static readonly STORAGE_KEY = "regismatic_theme";
  private mode: ThemeMode = "light";

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  init(): void {
    const saved = localStorage.getItem(ThemeService.STORAGE_KEY);

    if (saved === "light" || saved === "dark") {
      this.apply(saved);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    this.apply(prefersDark ? "dark" : "light");
  }

  toggle(): void {
    this.apply(this.mode === "dark" ? "light" : "dark");
  }

  get isDark(): boolean {
    return this.mode === "dark";
  }

  get currentMode(): ThemeMode {
    return this.mode;
  }

  private apply(mode: ThemeMode): void {
    this.mode = mode;

    const body = this.document.body;
    body.classList.remove("light-theme", "dark-theme");
    body.classList.add(mode === "dark" ? "dark-theme" : "light-theme");

    localStorage.setItem(ThemeService.STORAGE_KEY, mode);
  }
}

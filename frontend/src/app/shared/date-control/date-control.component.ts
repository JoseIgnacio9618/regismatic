import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from "@angular/core";
import { DatePicker } from "primeng/datepicker";
import { I18nService } from "src/app/core/services/i18n.service";

type DateControlMode = "date" | "datetime";

@Component({
  selector: "app-date-control",
  templateUrl: "./date-control.component.html",
  styleUrls: ["./date-control.component.scss"],
  standalone: false
})
export class DateControlComponent implements OnChanges {
  @Input() label = "";
  @Input() value = "";
  @Input() mode: DateControlMode = "date";
  @Input() placeholder = "";
  @Input() disabled = false;
  @Input() showClear = false;
  @Output() valueChange = new EventEmitter<string>();
  @ViewChild("picker") picker?: DatePicker;

  pickerValue: Date | null = null;
  readonly inputId = `app-date-control-${Math.random().toString(36).slice(2, 10)}`;

  constructor(private readonly i18nService: I18nService) {}

  get panelStyleClass(): string {
    return this.mode === "datetime" ? "app-date-control-overlay app-date-control-overlay-datetime" : "app-date-control-overlay";
  }

  get touchUi(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  }

  get dateFormat(): string {
    switch (this.i18nService.language) {
      case "en":
        return "mm/dd/yy";
      case "fr":
      case "es":
      default:
        return "dd/mm/yy";
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ("value" in changes || "mode" in changes) {
      this.pickerValue = this.parseValue(this.value);
    }
  }

  onPickerChange(value: Date | null): void {
    this.pickerValue = value;
    this.valueChange.emit(this.formatValue(value));
  }

  onDateSelect(): void {
    if (this.mode === "date") {
      this.picker?.hideOverlay();
    }
  }

  private parseValue(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    if (this.mode === "date") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) {
        return null;
      }

      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
    if (!match) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const [, year, month, day, hours, minutes, seconds = "00"] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
      0
    );
  }

  private formatValue(value: Date | null): string {
    if (!value) {
      return "";
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    if (this.mode === "date") {
      return `${year}-${month}-${day}`;
    }

    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    const seconds = String(value.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
}

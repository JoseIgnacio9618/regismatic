import { Component, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { AttendanceService } from "src/app/core/services/attendance.service";
import { TodayStatus } from "src/app/core/models/types";
import { I18nService } from "src/app/core/services/i18n.service";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.page.html",
  styleUrls: ["./dashboard.page.scss"],
  standalone: false
})
export class DashboardPage implements OnInit {
  status: TodayStatus | null = null;
  busy = false;
  statusLoading = false;
  loadError: string | null = null;

  constructor(
    private readonly attendanceService: AttendanceService,
    public readonly i18nService: I18nService,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.refreshStatus();
  }

  get stateLabel(): string {
    if (this.loadError) {
      return this.i18nService.t("dashboard.state.no_connection");
    }

    if (!this.status) {
      return this.i18nService.t("dashboard.state.pending");
    }

    if (this.status.state === "OFF") {
      return this.i18nService.t("dashboard.state.off");
    }

    if (this.status.state === "WORKING") {
      return this.i18nService.t("dashboard.state.working");
    }

    return this.i18nService.t("dashboard.state.on_break");
  }

  get effectiveState(): "OFF" | "WORKING" | "ON_BREAK" {
    return this.status?.state ?? "OFF";
  }

  minutesToHuman(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h}h ${m}m`;
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(this.i18nService.locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
  }

  async handleAction(action: "clockIn" | "breakStart" | "breakEnd" | "clockOut"): Promise<void> {
    this.busy = true;

    try {
      const coords = await this.getGeolocation();
      if (action === "clockIn") {
        await this.attendanceService.clockIn(coords);
      } else if (action === "breakStart") {
        await this.attendanceService.breakStart(coords);
      } else if (action === "breakEnd") {
        await this.attendanceService.breakEnd(coords);
      } else {
        await this.attendanceService.clockOut(coords);
      }

      await this.refreshStatus();
      await this.showToast(this.i18nService.t("dashboard.toast_event_registered"), "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : this.i18nService.t("dashboard.toast_event_failed"), "danger");
    } finally {
      this.busy = false;
    }
  }

  async refreshStatus(showErrorToast = false): Promise<void> {
    this.statusLoading = true;
    this.loadError = null;
    try {
      this.status = await this.attendanceService.getTodayStatus();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : this.i18nService.t("dashboard.error_load_status");
      this.status = null;
      if (showErrorToast) {
        await this.showToast(this.loadError, "danger");
      }
    } finally {
      this.statusLoading = false;
    }
  }

  private async getGeolocation(): Promise<{ latitude?: number; longitude?: number }> {
    if (!("geolocation" in navigator)) {
      return {};
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6))
          });
        },
        () => resolve({}),
        { timeout: 6000 }
      );
    });
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2000, color });
    await toast.present();
  }
}

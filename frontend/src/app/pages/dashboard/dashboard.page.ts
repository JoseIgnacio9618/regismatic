import { Component, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { AttendanceService } from "src/app/core/services/attendance.service";
import { TodayStatus } from "src/app/core/models/types";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.page.html",
  styleUrls: ["./dashboard.page.scss"],
  standalone: false
})
export class DashboardPage implements OnInit {
  status: TodayStatus | null = null;
  busy = false;

  readonly eventLabel: Record<string, string> = {
    CLOCK_IN: "Entrada",
    BREAK_START: "Inicio pausa",
    BREAK_END: "Fin pausa",
    CLOCK_OUT: "Salida",
    MANUAL_ADJUSTMENT: "Ajuste manual"
  };

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadStatus();
  }

  get stateLabel(): string {
    if (!this.status) {
      return "Sin datos";
    }

    if (this.status.state === "OFF") {
      return "Fuera de jornada";
    }

    if (this.status.state === "WORKING") {
      return "Trabajando";
    }

    return "En pausa";
  }

  minutesToHuman(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h}h ${m}m`;
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString("es-ES", {
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

      await this.loadStatus();
      await this.showToast("Evento registrado.", "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : "No se pudo registrar.", "danger");
    } finally {
      this.busy = false;
    }
  }

  private async loadStatus(): Promise<void> {
    this.status = await this.attendanceService.getTodayStatus();
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

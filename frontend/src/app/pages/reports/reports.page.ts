import { Component, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { SummaryRow, TeamUser } from "src/app/core/models/types";
import { AuthService } from "src/app/core/services/auth.service";
import { ReportService } from "src/app/core/services/report.service";
import { UserService } from "src/app/core/services/user.service";

@Component({
  selector: "app-reports",
  templateUrl: "./reports.page.html",
  styleUrls: ["./reports.page.scss"],
  standalone: false
})
export class ReportsPage implements OnInit {
  from = this.getWeekStart();
  to = new Date().toISOString().slice(0, 10);
  selectedUserId = "";
  users: TeamUser[] = [];
  rows: SummaryRow[] = [];
  loading = false;

  constructor(
    public readonly authService: AuthService,
    private readonly reportService: ReportService,
    private readonly userService: UserService,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.authService.isAdmin) {
      this.users = await this.userService.listUsers();
    }

    await this.loadReport();
  }

  minutesToHuman(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h}h ${m}m`;
  }

  async loadReport(): Promise<void> {
    this.loading = true;

    try {
      const response = await this.reportService.getSummary(this.from, this.to, this.selectedUserId || undefined);
      this.rows = response.rows;
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : "No se pudo cargar reporte.", "danger");
    } finally {
      this.loading = false;
    }
  }

  async downloadCsv(): Promise<void> {
    try {
      const csv = await this.reportService.downloadCsv(this.from, this.to, this.selectedUserId || undefined);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `regismatic-${this.from}-${this.to}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : "No se pudo descargar CSV.", "danger");
    }
  }

  private getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    now.setDate(now.getDate() - diff);
    return now.toISOString().slice(0, 10);
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2200, color });
    await toast.present();
  }
}

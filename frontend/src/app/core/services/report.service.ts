import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { SummaryRow } from "../models/types";

@Injectable({ providedIn: "root" })
export class ReportService {
  constructor(private readonly apiService: ApiService) {}

  getSummary(from: string, to: string, userId?: string): Promise<{ rows: SummaryRow[] }> {
    const params = new URLSearchParams({ from, to });
    if (userId) {
      params.set("userId", userId);
    }
    return this.apiService.get<{ rows: SummaryRow[] }>(`/reports/summary?${params.toString()}`, true);
  }

  downloadExcel(from: string, to: string, userId?: string): Promise<Blob> {
    const params = new URLSearchParams({ from, to });
    if (userId) {
      params.set("userId", userId);
    }
    return this.apiService.getBlob(`/reports/summary.xlsx?${params.toString()}`, true);
  }
}

import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { SummaryRow } from "../models/types";

export type SummaryReportResponse = {
  rows: SummaryRow[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable({ providedIn: "root" })
export class ReportService {
  constructor(private readonly apiService: ApiService) {}

  getSummary(from: string, to: string, userId?: string, page = 1, pageSize = 50): Promise<SummaryReportResponse> {
    const params = new URLSearchParams({ from, to });
    if (userId) {
      params.set("userId", userId);
    }
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return this.apiService.get<SummaryReportResponse>(`/reports/summary?${params.toString()}`, true);
  }

  downloadExcel(from: string, to: string, userId?: string): Promise<Blob> {
    const params = new URLSearchParams({ from, to });
    if (userId) {
      params.set("userId", userId);
    }
    return this.apiService.getBlob(`/reports/summary.xlsx?${params.toString()}`, true);
  }
}

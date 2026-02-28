import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { TodayStatus, WorkEvent } from "../models/types";

@Injectable({ providedIn: "root" })
export class AttendanceService {
  constructor(private readonly apiService: ApiService) {}

  getTodayStatus(): Promise<TodayStatus> {
    return this.apiService.get<TodayStatus>("/attendance/today", true);
  }

  async clockIn(payload: { latitude?: number; longitude?: number }): Promise<WorkEvent> {
    return this.apiService.post<WorkEvent>("/attendance/clock-in", { source: "WEB", ...payload }, true);
  }

  async breakStart(payload: { latitude?: number; longitude?: number }): Promise<WorkEvent> {
    return this.apiService.post<WorkEvent>("/attendance/break-start", { source: "WEB", ...payload }, true);
  }

  async breakEnd(payload: { latitude?: number; longitude?: number }): Promise<WorkEvent> {
    return this.apiService.post<WorkEvent>("/attendance/break-end", { source: "WEB", ...payload }, true);
  }

  async clockOut(payload: { latitude?: number; longitude?: number }): Promise<WorkEvent> {
    return this.apiService.post<WorkEvent>("/attendance/clock-out", { source: "WEB", ...payload }, true);
  }
}

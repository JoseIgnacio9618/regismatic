import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { AttendanceEventRecord, EditRequestStatus, TodayStatus, WorkEvent, WorkEventEditRequestRecord } from "../models/types";

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

  listEvents(from: string, to: string, userId?: string): Promise<{ events: AttendanceEventRecord[] }> {
    const params = new URLSearchParams({ from, to });
    if (userId) {
      params.set("userId", userId);
    }
    return this.apiService.get<{ events: AttendanceEventRecord[] }>(`/attendance/events?${params.toString()}`, true);
  }

  updateEventAsAdmin(
    eventId: string,
    payload: { eventAt?: string; note?: string | null; reason: string }
  ): Promise<AttendanceEventRecord> {
    return this.apiService.patch<AttendanceEventRecord>(`/attendance/events/${eventId}`, payload, true);
  }

  createEditRequest(
    eventId: string,
    payload: { requestedEventAt: string; requestedNote?: string | null; reason: string }
  ): Promise<WorkEventEditRequestRecord> {
    return this.apiService.post<WorkEventEditRequestRecord>(`/attendance/events/${eventId}/edit-requests`, payload, true);
  }

  listEditRequests(status?: EditRequestStatus, userId?: string): Promise<{ requests: WorkEventEditRequestRecord[] }> {
    const params = new URLSearchParams();
    if (status) {
      params.set("status", status);
    }
    if (userId) {
      params.set("userId", userId);
    }
    const query = params.toString();
    return this.apiService.get<{ requests: WorkEventEditRequestRecord[] }>(`/attendance/edit-requests${query ? `?${query}` : ""}`, true);
  }

  reviewEditRequest(requestId: string, action: "APPROVE" | "REJECT", reviewComment?: string): Promise<WorkEventEditRequestRecord> {
    return this.apiService.patch<WorkEventEditRequestRecord>(`/attendance/edit-requests/${requestId}/review`, { action, reviewComment }, true);
  }
}

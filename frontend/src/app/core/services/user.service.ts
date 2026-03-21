import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { Role, TeamJoinRequest, TeamUser } from "../models/types";

@Injectable({ providedIn: "root" })
export class UserService {
  constructor(private readonly apiService: ApiService) {}

  listUsers(): Promise<TeamUser[]> {
    return this.apiService.get<TeamUser[]>("/users", true);
  }

  createUser(payload: { email: string; fullName: string; password: string; role: Role; managerId?: string }): Promise<TeamUser> {
    return this.apiService.post<TeamUser>("/users", payload, true);
  }

  assignManager(userId: string, managerId: string): Promise<TeamUser> {
    return this.apiService.patch<TeamUser>(`/users/${userId}/manager`, { managerId }, true);
  }

  uploadOwnProfilePhoto(file: File): Promise<TeamUser> {
    const formData = new FormData();
    formData.append("photo", file);
    return this.apiService.postFormData<TeamUser>("/users/me/photo", formData, true);
  }

  removeOwnProfilePhoto(): Promise<TeamUser> {
    return this.apiService.delete<TeamUser>("/users/me/photo", true);
  }

  uploadUserProfilePhoto(userId: string, file: File): Promise<TeamUser> {
    const formData = new FormData();
    formData.append("photo", file);
    return this.apiService.postFormData<TeamUser>(`/users/${userId}/photo`, formData, true);
  }

  removeUserProfilePhoto(userId: string): Promise<TeamUser> {
    return this.apiService.delete<TeamUser>(`/users/${userId}/photo`, true);
  }

  deleteUser(userId: string): Promise<TeamUser> {
    return this.apiService.delete<TeamUser>(`/users/${userId}`, true);
  }

  listTeamJoinRequests(): Promise<TeamJoinRequest[]> {
    return this.apiService.get<TeamJoinRequest[]>("/users/team-join-requests", true);
  }

  createTeamJoinRequest(payload: { inviteCode: string; message?: string }): Promise<TeamJoinRequest> {
    return this.apiService.post<TeamJoinRequest>("/users/team-join-requests", payload, true);
  }

  reviewTeamJoinRequest(requestId: string, payload: { action: "APPROVE" | "REJECT"; reviewComment?: string }): Promise<TeamJoinRequest> {
    return this.apiService.post<TeamJoinRequest>(`/users/team-join-requests/${requestId}/review`, payload, true);
  }
}

import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { PaginatedResult, Role, TeamJoinRequest, TeamJoinRequestStatus, TeamUser } from "../models/types";

export type PaginatedUsersResponse = Omit<PaginatedResult<TeamUser>, "items"> & { users: TeamUser[] };
export type PaginatedTeamJoinRequestsResponse = Omit<PaginatedResult<TeamJoinRequest>, "items"> & { requests: TeamJoinRequest[] };

@Injectable({ providedIn: "root" })
export class UserService {
  constructor(private readonly apiService: ApiService) {}

  listUsers(params?: { page?: number; pageSize?: number; search?: string; role?: Role }): Promise<PaginatedUsersResponse> {
    const query = new URLSearchParams();
    if (params?.page) {
      query.set("page", String(params.page));
    }
    if (params?.pageSize) {
      query.set("pageSize", String(params.pageSize));
    }
    if (params?.search?.trim()) {
      query.set("search", params.search.trim());
    }
    if (params?.role) {
      query.set("role", params.role);
    }

    const queryString = query.toString();
    return this.apiService.get<PaginatedUsersResponse>(`/users${queryString ? `?${queryString}` : ""}`, true);
  }

  async listAllUsers(params?: { search?: string; role?: Role }): Promise<TeamUser[]> {
    const pageSize = 100;
    let page = 1;
    let users: TeamUser[] = [];

    while (true) {
      const response = await this.listUsers({ ...params, page, pageSize });
      users = users.concat(response.users);

      if (users.length >= response.total || response.users.length === 0) {
        return users;
      }

      page += 1;
    }
  }

  createUser(payload: { email: string; fullName: string; password: string; role: Role; managerId?: string }): Promise<TeamUser> {
    return this.apiService.post<TeamUser>("/users", payload, true);
  }

  assignManager(userId: string, managerId: string): Promise<TeamUser> {
    return this.apiService.patch<TeamUser>(`/users/${userId}/manager`, { managerId }, true);
  }

  resetUserPassword(userId: string, password: string): Promise<TeamUser> {
    return this.apiService.patch<TeamUser>(`/users/${userId}/password`, { password }, true);
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

  listTeamJoinRequests(params?: { page?: number; pageSize?: number; status?: TeamJoinRequestStatus }): Promise<PaginatedTeamJoinRequestsResponse> {
    const query = new URLSearchParams();
    if (params?.page) {
      query.set("page", String(params.page));
    }
    if (params?.pageSize) {
      query.set("pageSize", String(params.pageSize));
    }
    if (params?.status) {
      query.set("status", params.status);
    }

    const queryString = query.toString();
    return this.apiService.get<PaginatedTeamJoinRequestsResponse>(`/users/team-join-requests${queryString ? `?${queryString}` : ""}`, true);
  }

  async listAllTeamJoinRequests(params?: { status?: TeamJoinRequestStatus }): Promise<TeamJoinRequest[]> {
    const pageSize = 100;
    let page = 1;
    let requests: TeamJoinRequest[] = [];

    while (true) {
      const response = await this.listTeamJoinRequests({ ...params, page, pageSize });
      requests = requests.concat(response.requests);

      if (requests.length >= response.total || response.requests.length === 0) {
        return requests;
      }

      page += 1;
    }
  }

  createTeamJoinRequest(payload: { inviteCode: string; message?: string }): Promise<TeamJoinRequest> {
    return this.apiService.post<TeamJoinRequest>("/users/team-join-requests", payload, true);
  }

  reviewTeamJoinRequest(requestId: string, payload: { action: "APPROVE" | "REJECT"; reviewComment?: string }): Promise<TeamJoinRequest> {
    return this.apiService.post<TeamJoinRequest>(`/users/team-join-requests/${requestId}/review`, payload, true);
  }
}

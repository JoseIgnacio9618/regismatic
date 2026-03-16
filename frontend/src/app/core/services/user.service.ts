import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { Role, TeamUser } from "../models/types";

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

  deleteUser(userId: string): Promise<TeamUser> {
    return this.apiService.delete<TeamUser>(`/users/${userId}`, true);
  }
}

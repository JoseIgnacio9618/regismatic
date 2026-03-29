import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { ApiService } from "./api.service";
import { AuthUser, LoginResponse } from "../models/types";

@Injectable({ providedIn: "root" })
export class AuthService {
  private static readonly TOKEN_KEY = "regismatic_token";
  private readonly userState = new BehaviorSubject<AuthUser | null>(null);
  readonly user$ = this.userState.asObservable();

  constructor(
    private readonly apiService: ApiService,
    private readonly router: Router
  ) {}

  get user(): AuthUser | null {
    return this.userState.value;
  }

  get hasToken(): boolean {
    return Boolean(localStorage.getItem(AuthService.TOKEN_KEY));
  }

  get isAdmin(): boolean {
    return this.user?.role === "ADMIN" || this.user?.role === "SUPERADMIN";
  }

  get isSuperadmin(): boolean {
    return this.user?.role === "SUPERADMIN";
  }

  async bootstrap(): Promise<void> {
    if (!this.hasToken) {
      return;
    }

    try {
      await this.refreshCurrentUser();
    } catch {
      this.logout(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const response = await this.apiService.post<LoginResponse>("/auth/login", { email, password });
    await this.persistSession(response);
  }

  async registerAdmin(payload: { fullName: string; email: string; password: string }): Promise<void> {
    const response = await this.apiService.post<LoginResponse>("/auth/register-admin", payload);
    await this.persistSession(response);
  }

  async registerEmployee(payload: {
    fullName: string;
    email: string;
    password: string;
    inviteCode?: string;
    requestMessage?: string;
  }): Promise<void> {
    const response = await this.apiService.post<LoginResponse>("/auth/register-employee", payload);
    await this.persistSession(response);
  }

  async impersonateAsUser(userId: string): Promise<void> {
    const response = await this.apiService.post<LoginResponse>(`/users/${userId}/impersonate`, {}, true);
    await this.persistSession(response);
    await this.router.navigateByUrl("/dashboard", { replaceUrl: true });
  }

  async refreshCurrentUser(): Promise<void> {
    if (!this.hasToken) {
      return;
    }

    const me = await this.apiService.get<AuthUser>("/auth/me", true);
    this.userState.next(me);
  }

  private async persistSession(response: LoginResponse): Promise<void> {
    localStorage.setItem(AuthService.TOKEN_KEY, response.token);
    await this.refreshCurrentUser();
  }

  logout(navigate = true): void {
    localStorage.removeItem(AuthService.TOKEN_KEY);
    this.userState.next(null);
    if (navigate) {
      void this.router.navigateByUrl("/login");
    }
  }
}

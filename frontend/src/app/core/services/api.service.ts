import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class ApiService {
  private static readonly TOKEN_KEY = "regismatic_token";
  private readonly baseUrl =
    environment.apiBaseUrl === "API_BASE_URL_PLACEHOLDER" ? "http://localhost:4000/api" : environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  async get<T>(path: string, auth = false): Promise<T> {
    try {
      return await firstValueFrom(this.http.get<T>(`${this.baseUrl}${path}`, { headers: this.buildHeaders(auth) }));
    } catch (error) {
      throw this.toError(error);
    }
  }

  async post<T>(path: string, body: unknown, auth = false): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${path}`, body, {
          headers: this.buildHeaders(auth)
        })
      );
    } catch (error) {
      throw this.toError(error);
    }
  }

  async getText(path: string, auth = false): Promise<string> {
    try {
      return await firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, {
          headers: this.buildHeaders(auth),
          responseType: "text"
        })
      );
    } catch (error) {
      throw this.toError(error);
    }
  }

  private buildHeaders(auth: boolean): HttpHeaders {
    let headers = new HttpHeaders();
    if (auth) {
      const token = localStorage.getItem(ApiService.TOKEN_KEY);
      if (token) {
        headers = headers.set("Authorization", `Bearer ${token}`);
      }
    }
    return headers;
  }

  private toError(error: unknown): Error {
    if (typeof error === "object" && error !== null) {
      const maybeHttp = error as { error?: { message?: string }; message?: string; status?: number };
      if (maybeHttp.status === 0) {
        return new Error("No se pudo conectar con la API. Verifica backend en :4000 y que la base de datos este levantada.");
      }
      if (maybeHttp.error?.message) {
        return new Error(maybeHttp.error.message);
      }
      if (maybeHttp.message) {
        return new Error(maybeHttp.message);
      }
    }

    return new Error("Unexpected request error.");
  }
}

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { I18nService } from "./i18n.service";
import { RequestLoadingService } from "./request-loading.service";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class ApiService {
  private static readonly TOKEN_KEY = "regismatic_token";
  private readonly baseUrl =
    environment.apiBaseUrl === "API_BASE_URL_PLACEHOLDER" ? "http://localhost:4000/api" : environment.apiBaseUrl;
  private readonly backendErrorMap: Record<string, string> = {
    "Too many login attempts. Try again later.": "errors.too_many_login_attempts",
    "Validation error.": "errors.validation_error",
    "Not authenticated.": "errors.not_authenticated",
    "Insufficient permissions.": "errors.insufficient_permissions",
    "Missing or invalid authorization header.": "errors.missing_or_invalid_auth_header",
    "Invalid or expired token.": "errors.invalid_or_expired_token",
    "Unexpected server error.": "errors.unexpected_server_error",
    "Invalid credentials.": "errors.invalid_credentials",
    "User not found.": "errors.user_not_found",
    "Route not found.": "errors.route_not_found",
    "A user with this email already exists.": "errors.user_email_exists",
    "An employee must be assigned to an administrator.": "errors.employee_manager_required",
    "Selected manager is not a valid administrator.": "errors.invalid_manager",
    "Administrators can only create employees.": "errors.admin_employee_only",
    "You cannot delete an administrator who still has assigned employees.": "errors.admin_has_employees",
    "Only employees can be reassigned.": "errors.employee_reassign_only",
    "Invalid event sequence for current attendance state.": "errors.invalid_event_sequence",
    "minutesDelta cannot be zero.": "errors.minutes_delta_zero",
    "Invalid date range format. Use YYYY-MM-DD.": "errors.invalid_date_range_format",
    "The 'from' date must be before or equal to 'to'.": "errors.from_must_be_before_to",
    "Date range too large. Maximum supported range is 62 days.": "errors.date_range_too_large",
    "Debes indicar eventAt o note para modificar el registro.": "errors.required_event_or_note",
    "Solo los empleados pueden crear solicitudes.": "errors.only_employees_request",
    "Registro no encontrado.": "errors.record_not_found",
    "El motivo de modificacion es obligatorio.": "errors.modification_reason_required",
    "El motivo de la solicitud es obligatorio.": "errors.request_reason_required",
    "La solicitud no contiene cambios respecto al registro actual.": "errors.request_no_changes",
    "Ya tienes una solicitud pendiente para este registro.": "errors.request_already_pending",
    "Solicitud no encontrada.": "errors.request_not_found",
    "La solicitud ya fue revisada.": "errors.request_already_reviewed",
    "You cannot delete your own account.": "errors.cannot_delete_own_user",
    "Notification not found.": "errors.notification_not_found",
    "Invalid push token.": "errors.invalid_push_token"
  };

  constructor(
    private readonly http: HttpClient,
    private readonly i18nService: I18nService,
    private readonly requestLoadingService: RequestLoadingService
  ) {}

  async get<T>(path: string, auth = false): Promise<T> {
    return this.runWithLoading(async () => {
      return firstValueFrom(this.http.get<T>(`${this.baseUrl}${path}`, { headers: this.buildHeaders(auth) }));
    });
  }

  async post<T>(path: string, body: unknown, auth = false): Promise<T> {
    return this.runWithLoading(async () => {
      return firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${path}`, body, {
          headers: this.buildHeaders(auth)
        })
      );
    });
  }

  async patch<T>(path: string, body: unknown, auth = false): Promise<T> {
    return this.runWithLoading(async () => {
      return firstValueFrom(
        this.http.patch<T>(`${this.baseUrl}${path}`, body, {
          headers: this.buildHeaders(auth)
        })
      );
    });
  }

  async delete<T>(path: string, auth = false): Promise<T> {
    return this.runWithLoading(async () => {
      return firstValueFrom(this.http.delete<T>(`${this.baseUrl}${path}`, { headers: this.buildHeaders(auth) }));
    });
  }

  async getText(path: string, auth = false): Promise<string> {
    return this.runWithLoading(async () => {
      return firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, {
          headers: this.buildHeaders(auth),
          responseType: "text"
        })
      );
    });
  }

  async getBlob(path: string, auth = false): Promise<Blob> {
    return this.runWithLoading(async () => {
      return firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, {
          headers: this.buildHeaders(auth),
          responseType: "blob"
        })
      );
    });
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
        return new Error(this.i18nService.t("errors.api_unreachable"));
      }
      if (maybeHttp.error?.message) {
        return new Error(this.translateBackendError(maybeHttp.error.message));
      }
      if (maybeHttp.message) {
        return new Error(this.translateBackendError(maybeHttp.message));
      }
    }

    return new Error(this.i18nService.t("errors.unexpected_request"));
  }

  private async runWithLoading<T>(requestFn: () => Promise<T>): Promise<T> {
    const requestId = this.requestLoadingService.beginRequest();
    try {
      return await requestFn();
    } catch (error) {
      throw this.toError(error);
    } finally {
      this.requestLoadingService.endRequest(requestId);
    }
  }

  private translateBackendError(message: string): string {
    const normalized = message.trim();
    const directKey = this.backendErrorMap[normalized];
    if (directKey) {
      return this.i18nService.t(directKey);
    }

    const missingMatch = normalized.match(/^Missing ([a-zA-Z0-9_]+)\.$/);
    if (missingMatch) {
      const rawField = missingMatch[1];
      const fieldKey = `errors.field.${rawField}`;
      const translatedField = this.i18nService.t(fieldKey);
      const fieldLabel = translatedField === fieldKey ? rawField : translatedField;
      return this.i18nService.t("errors.missing_field", { field: fieldLabel });
    }

    return normalized;
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/** Respuesta estándar del backend. */
export interface ApiResponse<T = any> {
  success?: boolean;
  status?: string;
  message?: string;
  body?: T;
  [key: string]: any;
}

/** Error de una petición HTTP; conserva el status y el cuerpo de la respuesta. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: any,
  ) {
    super(message);
  }
}

type FormValue = string | number | boolean | Blob | File | null | undefined;

/**
 * Cliente HTTP base. Todas las llamadas POST se envían como FormData.
 * El token JWT se agrega automáticamente en `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly endpoint = environment.endpoint;

  get<T = ApiResponse>(url: string): Promise<T> {
    return this.request(this.http.get<T>(this.endpoint + url));
  }

  post<T = ApiResponse>(url: string, data: FormData | Record<string, FormValue | FormValue[]>): Promise<T> {
    const body = data instanceof FormData ? data : ApiService.toFormData(data);
    return this.request(this.http.post<T>(this.endpoint + url, body));
  }

  getBlob(url: string): Promise<Blob> {
    return this.request(this.http.get(this.endpoint + url, { responseType: 'blob' }));
  }

  /**
   * Convierte un objeto a FormData. Los arreglos (ej. varios archivos) se envían como `key[]`.
   */
  static toFormData(data: Record<string, FormValue | FormValue[]>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        value.forEach((item) => formData.append(`${key}[]`, ApiService.toEntry(item)));
      } else {
        formData.append(key, ApiService.toEntry(value));
      }
    }
    return formData;
  }

  private static toEntry(value: FormValue): string | Blob {
    return value instanceof Blob ? value : String(value ?? '');
  }

  private request<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs.pipe(catchError((err) => throwError(() => ApiService.toError(err)))));
  }

  private static toError(err: HttpErrorResponse): ApiError {
    let msg = `HTTP error! status: ${err.status}`;
    const data = err.error;
    if (data && typeof data === 'object' && !(data instanceof Blob)) {
      if (data.message) msg = data.message;
      else if (data.error) msg = data.error;
      else if (typeof data.body === 'string') msg = data.body;
      else if (typeof data.body?.message === 'string') msg = data.body.message;
      else msg = JSON.stringify(data);
    } else if (typeof data === 'string' && data) {
      try {
        const parsed = JSON.parse(data);
        msg = parsed.message || parsed.error || data;
      } catch {
        // respuesta no JSON, se conserva el mensaje por defecto
      }
    }
    console.error('Error en la petición HTTP:', err);
    return new ApiError(msg, err.status, data);
  }
}

/** Extrae el arreglo de una respuesta `{ success, body: [] }` o de un arreglo directo. */
export function extractList<T>(response: any): T[] {
  if (response && response.success && Array.isArray(response.body)) return response.body;
  if (Array.isArray(response)) return response;
  return [];
}

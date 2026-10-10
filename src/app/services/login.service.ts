import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

/** Llamadas al backend de la vista de login. */
@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly api = inject(ApiService);

  /** Devuelve el JWT buscando en los distintos niveles de la respuesta. */
  async login(email: string, password: string): Promise<string> {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    const response: any = await this.api.post('/login', formData);

    let token = response.token || response.jwt;
    if (!token && response.body) {
      token =
        response.body.token ||
        response.body.jwt ||
        (typeof response.body === 'string' ? response.body : null);
    }
    if (!token && response.data) {
      token = response.data.token || response.data.jwt;
    }
    if (!token) {
      throw new Error(
        'No se recibió el token de acceso por parte del servidor: ' + JSON.stringify(response),
      );
    }
    return token;
  }
}

import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  getToken(): string | null {
    return localStorage.getItem('token') || localStorage.getItem('jwt');
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  /** Valida que exista un JWT y que no haya expirado. */
  checkAuth(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return false;

      const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error validating JWT:', e);
      return false;
    }
  }

  /** Id del usuario logueado, tomado del payload del JWT. */
  getUserId(): string | null {
    const id = this.getPayload()?.['id'];
    return id != null ? String(id) : null;
  }

  /** Rol del usuario logueado, tomado del payload del JWT. */
  getRole(): string | null {
    return this.getPayload()?.['role'] ?? null;
  }

  private getPayload(): Record<string, any> | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payloadBase64 = token.split('.')[1];
      return JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('jwt');
    this.router.navigateByUrl('/portal/login');
  }
}

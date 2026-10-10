import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from '../../../services/login.service';
import { AuthService } from '../../../services/auth.service';
import { AlertService } from '../../../services/alert.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly service = inject(LoginService);
  private readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);
  private readonly router = inject(Router);

  protected readonly email = signal(localStorage.getItem('rememberedEmail') ?? '');
  protected readonly password = signal('');
  protected readonly rememberMe = signal(!!localStorage.getItem('rememberedEmail'));
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);

  protected async handleLogin(event: Event): Promise<void> {
    event.preventDefault();
    // Se leen los valores del form (no de los signals) porque el autollenado
    // del navegador no siempre dispara el evento (input).
    const form = new FormData(event.target as HTMLFormElement);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!email || !password) return;
    this.email.set(email);
    this.password.set(password);

    if (this.rememberMe()) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    this.loading.set(true);
    try {
      const token = await this.service.login(email, password);
      this.auth.setToken(token);
      if (this.rememberMe()) await this.storeCredential(email, password);
      await this.router.navigateByUrl('/portal/dashboard');
    } catch (error) {
      console.error('Error en login:', error);
      this.alert.showError(error, 'Error al iniciar sesión');
    } finally {
      this.loading.set(false);
    }
  }

  /** Guarda las credenciales en el gestor de contraseñas del navegador. */
  private async storeCredential(email: string, password: string): Promise<void> {
    const PasswordCredentialCtor = (window as any).PasswordCredential;
    if (!PasswordCredentialCtor || !navigator.credentials) return;
    try {
      await navigator.credentials.store(new PasswordCredentialCtor({ id: email, password, name: email }));
    } catch (e) {
      console.warn('No se pudieron guardar las credenciales:', e);
    }
  }
}

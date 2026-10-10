import { CanActivateChildFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Protege las vistas del portal: sin JWT válido se redirige al login. */
export const authGuard: CanActivateChildFn = () => {
  const auth = inject(AuthService);
  if (auth.checkAuth()) return true;
  auth.logout();
  return false;
};

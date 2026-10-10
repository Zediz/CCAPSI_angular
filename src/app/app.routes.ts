import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  // ===== Vistas públicas =====
  {
    path: '',
    title: 'CCAPSI — Centro de Capacitación en Seguridad Industrial',
    loadComponent: () => import('./views/public/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'cursos',
    title: 'Cursos - CCAPSI',
    loadComponent: () => import('./views/public/cursos/cursos').then((m) => m.Cursos),
  },
  {
    path: 'cursos/:uuid',
    title: 'Curso - CCAPSI',
    loadComponent: () =>
      import('./views/public/curso-detalle/curso-detalle').then((m) => m.CursoDetalle),
  },

  // ===== Portal administrativo =====
  {
    path: 'portal/login',
    title: 'Iniciar Sesión — CCAPSI',
    loadComponent: () => import('./views/portal/login/login').then((m) => m.Login),
  },
  {
    path: 'portal',
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./views/portal/portal-layout/portal-layout').then((m) => m.PortalLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'facturas',
        title: 'Facturas — CCAPSI',
        loadComponent: () => import('./views/portal/facturas/facturas').then((m) => m.Facturas),
      },
      {
        path: 'cotizaciones',
        title: 'Cotizaciones — CCAPSI',
        loadComponent: () =>
          import('./views/portal/cotizaciones/cotizaciones').then((m) => m.Cotizaciones),
      },
      {
        path: 'transferencias',
        title: 'Transferencias — CCAPSI',
        loadComponent: () =>
          import('./views/portal/transferencias/transferencias').then((m) => m.Transferencias),
      },
      {
        path: 'cursos',
        title: 'Cursos — CCAPSI',
        loadComponent: () =>
          import('./views/portal/admin-cursos/admin-cursos').then((m) => m.AdminCursos),
      },
      {
        path: 'dashboard',
        title: 'Dashboard — CCAPSI',
        loadComponent: () => import('./views/portal/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'clientes',
        title: 'Clientes — CCAPSI',
        loadComponent: () => import('./views/portal/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'calendario',
        title: 'Calendario — CCAPSI',
        loadComponent: () =>
          import('./views/portal/calendario/calendario').then((m) => m.Calendario),
      },
      {
        path: 'emails',
        title: 'Correos — CCAPSI',
        loadComponent: () => import('./views/portal/emails/emails').then((m) => m.Emails),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];

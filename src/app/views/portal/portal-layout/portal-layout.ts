import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DashboardNavbar } from '../../../components/dashboard-navbar/dashboard-navbar';

/** Layout de las vistas protegidas del portal: navbar del dashboard + vista activa. */
@Component({
  selector: 'app-portal-layout',
  imports: [RouterOutlet, DashboardNavbar],
  template: `
    <app-dashboard-navbar />
    <router-outlet />
  `,
})
export class PortalLayout {}

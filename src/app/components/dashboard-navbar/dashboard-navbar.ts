import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface NavLink {
  label: string;
  route?: string;
  icon: string;
}

interface NavDropdown {
  label: string;
  icon: string;
  /** Opciones del dropdown; sin `route` se muestran deshabilitadas ("Próximamente"). */
  items: NavLink[];
}

@Component({
  selector: 'app-dashboard-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './dashboard-navbar.html',
})
export class DashboardNavbar {
  private readonly auth = inject(AuthService);
  private readonly userMenu = viewChild.required<ElementRef<HTMLElement>>('userMenu');

  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);

  /** Label del dropdown de navegación abierto (solo uno a la vez). */
  protected readonly openDropdown = signal<string | null>(null);

  protected readonly links: NavLink[] = [
    { label: 'Dashboard', route: '/portal/dashboard', icon: 'fa-gauge-high' },
    { label: 'Facturas', route: '/portal/facturas', icon: 'fa-file-lines' },
    { label: 'Transferencias', route: '/portal/transferencias', icon: 'fa-money-bill-transfer' },
    { label: 'Cotizaciones', route: '/portal/cotizaciones', icon: 'fa-file-invoice-dollar' },
  ];

  protected readonly dropdowns: NavDropdown[] = [
    {
      label: 'Herramientas',
      icon: 'fa-screwdriver-wrench',
      items: [
        { label: 'Calendario', route: '/portal/calendario', icon: 'fa-calendar-days' },
        { label: 'Email', route: '/portal/emails', icon: 'fa-envelope' },
      ],
    },
    {
      label: 'Catálogo',
      icon: 'fa-layer-group',
      items: [
        { label: 'Clientes', route: '/portal/clientes', icon: 'fa-users' },
        { label: 'Cursos', route: '/portal/cursos', icon: 'fa-graduation-cap' },
        { label: 'Servicios', icon: 'fa-briefcase' },
      ],
    },
  ];

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 30);
  }

  /** Cierra los dropdowns al hacer clic fuera. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.userMenu().nativeElement.contains(target)) {
      this.userMenuOpen.set(false);
    }
    if (!target.closest?.('.dash-nav-dropdown')) {
      this.openDropdown.set(null);
    }
  }

  protected toggleDropdown(label: string): void {
    this.openDropdown.update((open) => (open === label ? null : label));
  }

  /** Al navegar se cierran el menú móvil y el dropdown abierto. */
  protected onNavigate(): void {
    this.menuOpen.set(false);
    this.openDropdown.set(null);
  }

  protected toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  protected logout(event: Event): void {
    event.preventDefault();
    this.auth.logout();
  }
}

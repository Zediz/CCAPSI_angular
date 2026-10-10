import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { scrollToSection } from '../scroll-to-section';

interface NavLink {
  key: string;
  label: string;
  fragment?: string;
  route?: string;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
})
export class Navbar {
  private readonly router = inject(Router);

  /** Sección activa: inicio | servicios | cursos | nosotros | contacto */
  readonly active = input('');
  readonly hideCta = input(false);
  /** Se emite al hacer clic en "Solicita cotización". */
  readonly cotizar = output<void>();

  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);

  protected readonly links: NavLink[] = [
    { key: 'inicio', label: 'Inicio', fragment: 'inicio' },
    { key: 'servicios', label: 'Servicios', fragment: 'servicios' },
    { key: 'cursos', label: 'Cursos', route: '/cursos' },
    { key: 'nosotros', label: 'Nosotros', fragment: 'nosotros' },
    { key: 'contacto', label: 'Contacto', fragment: 'contacto' },
  ];

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 50);
  }

  protected goTo(event: Event, fragment: string): void {
    this.menuOpen.set(false);
    scrollToSection(this.router, fragment, event);
  }

  protected onCotizar(event: Event): void {
    event.preventDefault();
    this.menuOpen.set(false);
    this.cotizar.emit();
  }
}

import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { scrollToSection } from '../scroll-to-section';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  private readonly router = inject(Router);

  protected readonly cursos = [
    { uuid: '2e751607', label: 'Supervisor de Seguridad y Salud' },
    { uuid: '603803a8', label: 'Seg. en Espacios Confinados' },
    { uuid: '39c0cb52', label: 'Manejo de Extintores' },
    { uuid: 'f511d9cb', label: 'Supervisor Ind. (EC0680)' },
    { uuid: '8f68d9d9', label: 'Sustancias Químicas' },
  ];

  protected goTo(event: Event, fragment: string): void {
    scrollToSection(this.router, fragment, event);
  }
}

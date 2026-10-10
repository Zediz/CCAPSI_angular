import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Navbar } from '../../../components/navbar/navbar';
import { Footer } from '../../../components/footer/footer';
import { CourseCard } from '../../../components/course-card/course-card';
import { CursosService } from '../../../services/cursos.service';
import { Course } from '../../../models/course';

@Component({
  selector: 'app-cursos',
  imports: [Navbar, Footer, CourseCard],
  templateUrl: './cursos.html',
  styleUrl: './cursos.scss',
})
export class Cursos {
  private readonly service = inject(CursosService);
  private readonly router = inject(Router);

  protected readonly allCourses = signal<Course[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly search = signal('');

  /** Todas las palabras buscadas deben estar en el título. */
  protected readonly filteredCourses = computed(() => {
    const words = this.search().toLowerCase().trim().split(' ').filter((w) => w.length > 0);
    if (words.length === 0) return this.allCourses();
    return this.allCourses().filter((curso) => {
      const title = (curso.title || '').toLowerCase();
      return words.every((word) => title.includes(word));
    });
  });

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.allCourses.set(await this.service.getAll());
      this.state.set('ready');
    } catch (error) {
      console.error('Error al cargar los cursos:', error);
      this.state.set('error');
    }
  }

  /** El CTA del navbar abre el modal de cotización de la landing. */
  protected goToCotizar(): void {
    this.router.navigate(['/'], { state: { cotizar: true } });
  }
}

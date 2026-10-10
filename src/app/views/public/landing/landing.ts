import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Navbar } from '../../../components/navbar/navbar';
import { Footer } from '../../../components/footer/footer';
import { CourseCard } from '../../../components/course-card/course-card';
import { AnimateOnScroll } from '../../../directives/animate-on-scroll';
import { scrollToSection } from '../../../components/scroll-to-section';
import { LandingService } from '../../../services/landing.service';
import { AlertService } from '../../../services/alert.service';
import { Course, CourseOption } from '../../../models/course';

interface Stat {
  target: number;
  suffix: string;
  label: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Navbar, Footer, CourseCard, AnimateOnScroll],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnDestroy {
  private readonly service = inject(LandingService);
  private readonly alert = inject(AlertService);
  private readonly router = inject(Router);

  private readonly heroImg = viewChild<ElementRef<HTMLImageElement>>('heroImg');
  private readonly heroStats = viewChild<ElementRef<HTMLElement>>('heroStats');
  private readonly cotizarForm = viewChild<ElementRef<HTMLFormElement>>('cotizarForm');

  // Hero stats
  protected readonly stats: Stat[] = [
    { target: 2500, suffix: '+', label: 'Alumnos certificados' },
    { target: 98, suffix: '%', label: 'Satisfacción' },
    { target: 50, suffix: '+', label: 'Cursos disponibles' },
  ];
  protected readonly statValues = signal(this.stats.map((s) => s.target.toLocaleString()));

  // Carrusel de cursos
  protected readonly courses = signal<Course[]>([]);
  protected readonly coursesState = signal<'loading' | 'ready' | 'empty' | 'error'>('loading');

  // Modal cotizar
  protected readonly modalOpen = signal(false);
  protected readonly sending = signal(false);
  protected readonly courseOptions = signal<CourseOption[]>([]);
  protected readonly optionsState = signal<'loading' | 'ready' | 'empty' | 'error'>('loading');

  private heroObserver?: IntersectionObserver;
  private counterTimers: ReturnType<typeof setInterval>[] = [];

  constructor() {
    this.loadCourses();
    this.loadCourseOptions();

    // Abrir el modal si se llegó desde el CTA del navbar en otra página
    if (history.state?.cotizar) this.modalOpen.set(true);

    afterNextRender(() => {
      const stats = this.heroStats()?.nativeElement;
      if (!stats) return;
      this.heroObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.animateCounters();
              this.heroObserver?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 },
      );
      this.heroObserver.observe(stats);
    });
  }

  ngOnDestroy(): void {
    this.heroObserver?.disconnect();
    this.counterTimers.forEach(clearInterval);
  }

  /** Parallax en la imagen del hero. */
  @HostListener('window:scroll')
  onScroll(): void {
    const img = this.heroImg()?.nativeElement;
    if (img) img.style.transform = `translateY(${window.scrollY * 0.08}px)`;
  }

  protected scrollTo(event: Event, id: string): void {
    scrollToSection(this.router, id, event);
  }

  private animateCounters(): void {
    this.stats.forEach((stat, i) => {
      let current = 0;
      const increment = stat.target / 60;
      const timer = setInterval(() => {
        current += increment;
        if (current >= stat.target) {
          current = stat.target;
          clearInterval(timer);
        }
        this.statValues.update((v) => {
          const next = [...v];
          next[i] = Math.floor(current).toLocaleString();
          return next;
        });
      }, 25);
      this.counterTimers.push(timer);
    });
  }

  private async loadCourses(): Promise<void> {
    try {
      const courses = await this.service.getIndexCourses();
      // Se duplican las tarjetas para el efecto de scroll infinito
      this.courses.set([...courses, ...courses]);
      this.coursesState.set(courses.length ? 'ready' : 'empty');
    } catch (error) {
      console.error('Error al cargar los cursos:', error);
      this.coursesState.set('error');
    }
  }

  private async loadCourseOptions(): Promise<void> {
    try {
      const options = await this.service.getCourseOptions();
      this.courseOptions.set(options);
      this.optionsState.set(options.length ? 'ready' : 'empty');
    } catch (error) {
      console.error('Error al cargar opciones de cursos:', error);
      this.optionsState.set('error');
    }
  }

  protected optionLabel(opt: CourseOption): string {
    return opt.title || opt.name || opt.nombre || 'Curso';
  }

  protected openModal(event?: Event): void {
    event?.preventDefault();
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.cotizarForm()?.nativeElement.reset();
  }

  protected async submitCotizacion(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    this.sending.set(true);
    try {
      await this.service.createCotizacion(new FormData(form));
      this.modalOpen.set(false);
      form.reset();
      this.alert.fire({
        icon: 'success',
        title: '¡Enviado!',
        text: 'Solicitud de cotización enviada. Te estaremos contestando lo antes posible.',
        confirmButtonColor: '#0056b3',
      });
    } catch (error) {
      console.error('Error enviando cotización:', error);
      this.alert.showError(error, 'Error al enviar');
    } finally {
      this.sending.set(false);
    }
  }
}

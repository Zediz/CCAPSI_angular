import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
  effect,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Navbar } from '../../../components/navbar/navbar';
import { Footer } from '../../../components/footer/footer';
import { CursoDetalleService } from '../../../services/curso-detalle.service';
import { AlertService } from '../../../services/alert.service';
import { TemarioModulo } from '../../../models/course';

interface CourseView {
  category: string;
  title: string;
  subtitle: string;
  instructor: string;
  image_url: string;
  duration_hours: string;
  materials_included: string;
  certification_type: string;
  modalidad: string;
  reviews_count: string;
  students_count: string;
  rating: string;
  lecciones: number;
  requisitos: string[];
  beneficios: string[];
  temario: TemarioModulo[];
}

@Component({
  selector: 'app-curso-detalle',
  imports: [RouterLink, Navbar, Footer],
  templateUrl: './curso-detalle.html',
  styleUrl: './curso-detalle.scss',
})
export class CursoDetalle implements OnDestroy {
  private readonly service = inject(CursoDetalleService);
  private readonly alert = inject(AlertService);
  private readonly titleService = inject(Title);
  private readonly router = inject(Router);

  /** UUID del curso (parámetro de la ruta /cursos/:uuid). */
  readonly uuid = input.required<string>();

  private readonly pricingCard = viewChild<ElementRef<HTMLElement>>('pricingCard');
  private readonly cotizarForm = viewChild<ElementRef<HTMLFormElement>>('cotizarForm');
  private readonly interesadoForm = viewChild<ElementRef<HTMLFormElement>>('interesadoForm');

  protected readonly heroTitle = signal('Cargando curso...');
  protected readonly heroSubtitle = signal('Por favor espere mientras se carga la información del curso.');
  protected readonly course = signal<CourseView | null>(null);
  protected readonly openModules = signal<Set<number>>(new Set([0]));

  protected readonly cotizarOpen = signal(false);
  protected readonly interesadoOpen = signal(false);
  protected readonly sendingCotizar = signal(false);
  protected readonly sendingInteresado = signal(false);
  protected readonly stickyHidden = signal(false);

  private observer?: IntersectionObserver;

  constructor() {
    effect(() => {
      this.loadCourse(this.uuid());
    });

    // Oculta el footer sticky (móvil) cuando la tarjeta de precios está visible
    afterNextRender(() => {
      const card = this.pricingCard()?.nativeElement;
      if (!card) return;
      this.observer = new IntersectionObserver(
        (entries) => entries.forEach((entry) => this.stickyHidden.set(entry.isIntersecting)),
        { threshold: 0.1 },
      );
      this.observer.observe(card);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private async loadCourse(uuid: string): Promise<void> {
    this.course.set(null);
    this.heroTitle.set('Cargando curso...');
    this.heroSubtitle.set('Por favor espere mientras se carga la información del curso.');
    this.openModules.set(new Set([0]));

    try {
      const data: any = await this.service.getCourse(uuid);
      const parse = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v);
      const temario: TemarioModulo[] = parse(data.temario) || [];
      const lecciones = Array.isArray(temario)
        ? temario.reduce((total, m) => total + (m.lessons ? m.lessons.length : 0), 0)
        : 0;

      this.course.set({
        category: data.category,
        title: data.title,
        subtitle: data.subtitle,
        instructor: data.instructor,
        image_url: data.image_url,
        duration_hours: data.duration_hours,
        materials_included: data.materials_included,
        certification_type: data.certification_type,
        modalidad: data.modalidad,
        reviews_count: data.reviews_count,
        students_count: data.students_count,
        rating: data.rating,
        lecciones,
        requisitos: parse(data.requisitos) || [],
        beneficios: parse(data.beneficios) || [],
        temario: Array.isArray(temario) ? temario : [],
      });
      this.heroTitle.set(data.title);
      this.heroSubtitle.set(data.subtitle);
      this.titleService.setTitle(`${data.title} - CCAPSI`);
    } catch (error) {
      console.error('Error loading course:', error);
      this.heroTitle.set('Error al cargar el curso');
      this.heroSubtitle.set('Hubo un problema al cargar la información del curso.');
      this.alert.showError(error, 'Error');
    }
  }

  /** Convierte **negritas** a <strong>. Angular sanitiza el HTML resultante. */
  protected formatRequisito(req: string): string {
    return req.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  protected toggleModule(index: number): void {
    this.openModules.update((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  /** El CTA del navbar abre el modal de cotización de la landing. */
  protected goToCotizar(): void {
    this.router.navigate(['/'], { state: { cotizar: true } });
  }

  protected closeCotizar(): void {
    this.cotizarOpen.set(false);
    this.cotizarForm()?.nativeElement.reset();
  }

  protected closeInteresado(): void {
    this.interesadoOpen.set(false);
    this.interesadoForm()?.nativeElement.reset();
  }

  protected async submitCotizar(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    this.sendingCotizar.set(true);
    try {
      const formData = new FormData(form);
      formData.append('course_uuid', this.uuid());
      await this.service.createCotizacion(formData);
      this.cotizarOpen.set(false);
      form.reset();
      this.alert.fire({
        icon: 'success',
        title: '¡Cotización enviada!',
        text: 'Todo se envió correctamente y te estaremos contestando lo antes posible.',
        confirmButtonColor: '#0056b3',
      });
    } catch (error) {
      console.error('Error enviando cotización:', error);
      this.alert.showError(error, 'Error al enviar');
    } finally {
      this.sendingCotizar.set(false);
    }
  }

  protected async submitInteresado(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    this.sendingInteresado.set(true);
    try {
      const formData = new FormData(form);
      formData.append('course_uuid', this.uuid());
      await this.service.createInteresado(formData);
      this.interesadoOpen.set(false);
      form.reset();
      this.alert.fire({
        icon: 'success',
        title: '¡Datos enviados!',
        text: 'Todo se envió correctamente y te estaremos contestando lo antes posible.',
        confirmButtonColor: '#0056b3',
      });
    } catch (error) {
      console.error('Error enviando información:', error);
      this.alert.showError(error, 'Error al enviar');
    } finally {
      this.sendingInteresado.set(false);
    }
  }
}

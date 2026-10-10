import { Component, computed, inject, signal } from '@angular/core';
import { AdminCursosService } from '../../../services/admin-cursos.service';
import { AlertService } from '../../../services/alert.service';
import { Course, TemarioModulo } from '../../../models/course';
import { TagInput } from '../../../components/tag-input/tag-input';
import { SortDirection, sortRows } from '../../../components/portal-utils';

interface CourseForm {
  id: string;
  uuid: string;
  title: string;
  subtitle: string;
  category: string;
  image_url: string;
  instructor: string;
  duration_hours: string;
  materials_included: string;
  certification_type: string;
  modalidad: string;
  price: string;
}

const EMPTY_FORM: CourseForm = {
  id: '',
  uuid: '',
  title: '',
  subtitle: '',
  category: '',
  image_url: '',
  instructor: '',
  duration_hours: '',
  materials_included: '',
  certification_type: '',
  modalidad: '',
  price: '',
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** Convierte requisitos / beneficios (JSON, CSV o arreglo) a una lista de etiquetas. */
function parseTags(value: Course['requisitos']): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter((t) => t);
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === 'string' && t.trim());
  } catch {
    // no es JSON, se interpreta como lista separada por comas
  }
  return value.split(',').map((t) => t.trim()).filter((t) => t);
}

function parseTemario(value: Course['temario']): TemarioModulo[] {
  if (!value) return [];
  if (Array.isArray(value)) return structuredClone(value);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Component({
  selector: 'app-admin-cursos',
  imports: [TagInput],
  templateUrl: './admin-cursos.html',
  styleUrl: './admin-cursos.scss',
})
export class AdminCursos {
  private readonly service = inject(AdminCursosService);
  private readonly alert = inject(AlertService);

  // Tabla
  protected readonly cursos = signal<Course[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly search = signal('');
  protected readonly sort = signal<{ column: string; direction: SortDirection }>({
    column: 'created_at',
    direction: 'desc',
  });

  protected readonly rows = computed(() => {
    const { column, direction } = this.sort();
    let data = sortRows(this.cursos(), column, direction, [], ['created_at', 'updated_at']);
    const term = this.search().toLowerCase().trim();
    if (term) {
      data = data.filter(
        (c) =>
          (c.title || '').toLowerCase().includes(term) ||
          (c.category || '').toLowerCase().includes(term) ||
          (c.uuid || '').toLowerCase().includes(term),
      );
    }
    return data.map((curso) => ({
      curso,
      uuid: curso.uuid || 'N/A',
      title: curso.title || 'N/A',
      category: curso.category || 'N/A',
      createdAt: curso.created_at
        ? new Date(curso.created_at).toLocaleDateString('es-MX', DATE_FORMAT)
        : 'N/A',
      updatedAt: curso.updated_at
        ? new Date(curso.updated_at).toLocaleDateString('es-MX', DATE_FORMAT)
        : 'N/A',
    }));
  });

  // Modal crear / editar
  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly form = signal<CourseForm>({ ...EMPTY_FORM });
  protected readonly requisitos = signal<string[]>([]);
  protected readonly beneficios = signal<string[]>([]);
  protected readonly temario = signal<TemarioModulo[]>([]);

  constructor() {
    this.loadCursos();
  }

  protected async loadCursos(): Promise<void> {
    this.state.set('loading');
    try {
      this.cursos.set(await this.service.getAll());
      this.state.set('ready');
    } catch (error) {
      console.error('Error fetching cursos:', error);
      this.state.set('error');
    }
  }

  // ===== Ordenamiento =====
  protected sortTable(column: string): void {
    this.sort.update((s) =>
      s.column === column
        ? { column, direction: s.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' },
    );
  }

  protected sortIcon(column: string): string {
    const s = this.sort();
    if (s.column !== column) return 'fa-solid fa-sort';
    return s.direction === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
  }

  protected sortClass(column: string): string {
    const s = this.sort();
    return s.column === column ? `sort-${s.direction}` : '';
  }

  // ===== Modal =====
  protected onRowClick(curso: Course): void {
    // No abrir el modal si el usuario está seleccionando texto para copiar
    if ((window.getSelection()?.toString().length ?? 0) > 0) return;
    this.openCourseModal(curso);
  }

  protected openCourseModal(curso: Course | null = null): void {
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    this.form.set(
      curso
        ? {
            id: str(curso.id),
            uuid: str(curso.uuid),
            title: str(curso.title),
            subtitle: str(curso.subtitle),
            category: str(curso.category),
            image_url: str(curso.image_url),
            instructor: str(curso.instructor),
            duration_hours: str(curso.duration_hours),
            materials_included: str(curso.materials_included),
            certification_type: str(curso.certification_type),
            modalidad: str(curso.modalidad),
            price: str(curso.price),
          }
        : { ...EMPTY_FORM },
    );

    this.requisitos.set(parseTags(curso?.requisitos));
    this.beneficios.set(parseTags(curso?.beneficios));

    let temario = parseTemario(curso?.temario);
    if (temario.length === 0 && !curso) {
      temario = [{ title: 'INTRODUCCIÓN Y DEFINICIONES', meta: '1 tema', lessons: ['Introducción general'] }];
    }
    this.temario.set(temario.map((m) => ({ ...m, lessons: Array.isArray(m.lessons) ? m.lessons : [] })));

    this.modalOpen.set(true);
  }

  protected closeCourseModal(): void {
    this.modalOpen.set(false);
  }

  protected setField(key: keyof CourseForm, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  // ===== Temario =====
  protected addTemarioModule(): void {
    this.temario.update((t) => [...t, { title: '', meta: '', lessons: [] }]);
  }

  protected removeTemarioModule(index: number): void {
    this.temario.update((t) => t.filter((_, i) => i !== index));
  }

  protected updateModule(index: number, changes: Partial<TemarioModulo>): void {
    this.temario.update((t) => t.map((m, i) => (i === index ? { ...m, ...changes } : m)));
  }

  // ===== Guardar =====
  protected async saveCourse(): Promise<void> {
    const f = this.form();
    if (!f.title.trim()) {
      this.alert.showError(new Error('El título del curso es requerido'), 'Validación');
      return;
    }

    const payload: Record<string, string | number> = {
      title: f.title,
      subtitle: f.subtitle,
      category: f.category,
      image_url: f.image_url,
      instructor: f.instructor,
      duration_hours: f.duration_hours,
      materials_included: f.materials_included,
      certification_type: f.certification_type,
      modalidad: f.modalidad,
      price: f.price,
      rating: (Math.random() * (5 - 4.5) + 4.5).toFixed(1),
      reviews_count: Math.floor(Math.random() * (1000 - 500 + 1)) + 500,
      students_count: Math.floor(Math.random() * (1000 - 500 + 1)) + 500,
      requisitos: JSON.stringify(this.requisitos()),
      temario: JSON.stringify(this.temario(), null, 2),
      beneficios: JSON.stringify(this.beneficios()),
    };

    const isEdit = !!f.id;
    if (isEdit) {
      payload['id'] = f.id;
      payload['uuid'] = f.uuid;
    }

    this.saving.set(true);
    try {
      await (isEdit ? this.service.update(payload) : this.service.create(payload));
      this.alert.showSuccess(
        '¡Operación exitosa!',
        isEdit ? 'Curso actualizado correctamente' : 'Curso creado correctamente',
      );
      this.closeCourseModal();
      this.loadCursos();
    } catch (error) {
      console.error('Error saving course', error);
      this.alert.showError(error, 'Error al guardar el curso');
    } finally {
      this.saving.set(false);
    }
  }
}

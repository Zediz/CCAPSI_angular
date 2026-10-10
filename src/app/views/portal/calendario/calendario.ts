import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CursosAgendadosService, CursoAgendado } from '../../../services/cursos-agendados.service';
import { AlertService } from '../../../services/alert.service';
import { AuthService } from '../../../services/auth.service';
import { AnimatedModal, formatYmd } from '../../../components/portal-utils';
import { CourseOption } from '../../../models/course';

type CalendarView = 'day' | 'week' | 'month';
type Tipo = 'curso' | 'bloqueo';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Eventos visibles por celda en la vista de mes; el resto se agrupa en "+N más". */
const MAX_EVENTS_PER_CELL = 3;
/** Días hacia adelante que se muestran en la lista de próximos eventos. */
const UPCOMING_DAYS = 90;

interface CalEvent {
  raw: CursoAgendado;
  id: string | number;
  bloqueo: boolean;
  title: string;
  /** online | presencial | bloqueo; define el color del evento. */
  kind: string;
  start: Date;
  end: Date;
  allDay: boolean;
  timeLabel: string;
  dateLabel: string;
}

interface CalDay {
  date: Date;
  ymd: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: CalEvent[];
  hidden: number;
}

/** Convierte `Y-m-d H:i:s` (hora local) a Date sin depender del parser del navegador. */
function parseDateTime(value: string): Date {
  const [d, t = '00:00:00'] = value.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [h, i, s] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h || 0, i || 0, s || 0);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function toEvent(raw: CursoAgendado): CalEvent {
  const start = parseDateTime(raw.start_date);
  const end = parseDateTime(raw.end_date);
  const allDay = raw.all_day === true || String(raw.all_day) === '1';
  const bloqueo = !raw.curso?.trim();
  const sameDay = formatYmd(start) === formatYmd(end);

  let dateLabel = formatShortDate(start);
  if (!sameDay) dateLabel += ` – ${formatShortDate(end)}`;

  return {
    raw,
    id: raw.id,
    bloqueo,
    title: bloqueo ? raw.descripcion?.trim() || 'Horario bloqueado' : raw.curso!.trim(),
    kind: bloqueo ? 'bloqueo' : raw.modalidad || 'presencial',
    start,
    end,
    allDay,
    timeLabel: allDay ? 'Todo el día' : `${formatTime(start)} - ${formatTime(end)}`,
    dateLabel,
  };
}

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.html',
  styleUrls: ['./calendario.scss', './calendario-modal.scss'],
})
export class Calendario {
  private readonly service = inject(CursosAgendadosService);
  private readonly alert = inject(AlertService);
  private readonly auth = inject(AuthService);

  private readonly eventoForm = viewChild.required<ElementRef<HTMLFormElement>>('eventoForm');

  protected readonly weekdays = WEEKDAYS;
  protected readonly view = signal<CalendarView>('month');
  /** Fecha de referencia del calendario (mes, semana o día visible). */
  protected readonly cursor = signal(startOfDay(new Date()));

  protected readonly eventos = signal<CalEvent[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly upcoming = signal<CalEvent[]>([]);
  protected readonly upcomingState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly courseOptions = signal<CourseOption[]>([]);

  // Modal crear / editar
  protected readonly eventoModal = new AnimatedModal();
  protected readonly editing = signal<CalEvent | null>(null);
  protected readonly tipo = signal<Tipo>('curso');
  protected readonly allDay = signal(false);
  protected readonly saving = signal(false);

  /** Id de la última carga de eventos, para descartar respuestas viejas. */
  private loadId = 0;

  /** Primer y último día (inclusive) que se dibujan en la vista actual. */
  private readonly range = computed(() => {
    const cursor = this.cursor();
    switch (this.view()) {
      case 'day':
        return { start: cursor, end: cursor };
      case 'week': {
        const start = addDays(cursor, -cursor.getDay());
        return { start, end: addDays(start, 6) };
      }
      default: {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const start = addDays(first, -first.getDay());
        return { start, end: addDays(start, 41) };
      }
    }
  });

  protected readonly title = computed(() => {
    const cursor = this.cursor();
    const { start, end } = this.range();
    switch (this.view()) {
      case 'day':
        return `${WEEKDAYS_LONG[cursor.getDay()]} ${cursor.getDate()} de ${MONTHS[cursor.getMonth()].toLowerCase()} ${cursor.getFullYear()}`;
      case 'week':
        return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${formatShortDate(end)}`;
      default:
        return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }
  });

  protected readonly days = computed<CalDay[]>(() => {
    const { start, end } = this.range();
    const month = this.cursor().getMonth();
    const today = formatYmd(new Date());
    const limit = this.view() === 'month' ? MAX_EVENTS_PER_CELL : Infinity;
    const days: CalDay[] = [];

    for (let date = start; date <= end; date = addDays(date, 1)) {
      const next = addDays(date, 1);
      const events = this.eventos().filter((e) => e.start < next && e.end > date);
      const ymd = formatYmd(date);
      days.push({
        date,
        ymd,
        day: date.getDate(),
        inMonth: this.view() !== 'month' || date.getMonth() === month,
        isToday: ymd === today,
        events: events.slice(0, limit),
        hidden: Math.max(0, events.length - limit),
      });
    }
    return days;
  });

  constructor() {
    effect(() => {
      const { start, end } = this.range();
      this.loadEventos(formatYmd(start), formatYmd(end));
    });
    this.loadUpcoming();
    this.service
      .getCourseOptions()
      .then((options) => this.courseOptions.set(options))
      .catch((error) => console.error('Error fetching courses:', error));
  }

  private async loadEventos(start: string, end: string): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    try {
      const data = await this.service.getAllByDate(start, end);
      if (id !== this.loadId) return;
      this.eventos.set(data.map(toEvent));
      this.state.set('ready');
    } catch (error) {
      if (id !== this.loadId) return;
      console.error('Error fetching cursos agendados:', error);
      this.state.set('error');
    }
  }

  private async loadUpcoming(): Promise<void> {
    const today = new Date();
    try {
      const data = await this.service.getAllByDate(
        formatYmd(today),
        formatYmd(addDays(today, UPCOMING_DAYS)),
      );
      this.upcoming.set(data.map(toEvent).filter((e) => e.end >= today));
      this.upcomingState.set('ready');
    } catch (error) {
      console.error('Error fetching próximos eventos:', error);
      this.upcomingState.set('error');
    }
  }

  private reload(): void {
    const { start, end } = this.range();
    this.loadEventos(formatYmd(start), formatYmd(end));
    this.loadUpcoming();
  }

  // ===== Navegación =====
  protected setView(view: CalendarView): void {
    this.view.set(view);
  }

  protected move(direction: 1 | -1): void {
    const cursor = this.cursor();
    switch (this.view()) {
      case 'day':
        this.cursor.set(addDays(cursor, direction));
        break;
      case 'week':
        this.cursor.set(addDays(cursor, 7 * direction));
        break;
      default:
        this.cursor.set(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
    }
  }

  protected goToday(): void {
    this.cursor.set(startOfDay(new Date()));
  }

  protected showDay(day: CalDay): void {
    this.cursor.set(day.date);
    this.view.set('day');
  }

  // ===== Modal crear / editar =====
  protected openCreateModal(tipo: Tipo, date?: Date): void {
    const day = formatYmd(date ?? this.cursor());
    this.editing.set(null);
    this.tipo.set(tipo);
    this.allDay.set(tipo === 'bloqueo');
    this.eventoForm().nativeElement.reset();
    this.setFields({
      fecha_inicio: day,
      hora_inicio: '09:00',
      fecha_fin: day,
      hora_fin: tipo === 'bloqueo' ? '18:00' : '10:00',
    });
    this.eventoModal.open();
  }

  protected openEditModal(event: CalEvent): void {
    const raw = event.raw;
    this.editing.set(event);
    this.tipo.set(event.bloqueo ? 'bloqueo' : 'curso');
    this.allDay.set(event.allDay);
    this.eventoForm().nativeElement.reset();
    this.setFields({
      curso: raw.curso,
      cliente: raw.cliente,
      modalidad: raw.modalidad || 'presencial',
      ubicacion: raw.ubicacion,
      duracion: raw.duracion,
      descripcion: raw.descripcion,
      fecha_inicio: formatYmd(event.start),
      hora_inicio: formatTime(event.start),
      fecha_fin: formatYmd(event.end),
      hora_fin: formatTime(event.end),
    });
    this.eventoModal.open();
  }

  private setFields(values: Record<string, unknown>): void {
    const form = this.eventoForm().nativeElement;
    for (const [name, value] of Object.entries(values)) {
      (form.elements.namedItem(name) as HTMLInputElement).value = String(value ?? '');
    }
  }

  protected closeEventoModal(): void {
    this.eventoModal.close();
  }

  protected async submitEvento(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.target as HTMLFormElement);
    const get = (name: string) => String(form.get(name) ?? '').trim();
    const allDay = this.allDay();
    const bloqueo = this.tipo() === 'bloqueo';
    const editing = this.editing();

    const startDate = `${get('fecha_inicio')} ${allDay ? '00:00' : get('hora_inicio')}:00`;
    const endDate = `${get('fecha_fin')} ${allDay ? '23:59:59' : get('hora_fin') + ':00'}`;
    if (parseDateTime(endDate) <= parseDateTime(startDate)) {
      this.alert.fire({
        title: 'Fechas inválidas',
        text: 'La fecha de fin debe ser posterior a la de inicio.',
        icon: 'warning',
      });
      return;
    }

    const data: Record<string, string> = {
      curso: bloqueo ? '' : get('curso'),
      cliente: bloqueo ? '' : get('cliente'),
      modalidad: bloqueo ? '' : get('modalidad'),
      ubicacion: bloqueo ? '' : get('ubicacion'),
      duracion: bloqueo ? '' : get('duracion'),
      descripcion: get('descripcion'),
      start_date: startDate,
      end_date: endDate,
      all_day: allDay ? '1' : '0',
    };
    const userId = this.auth.getUserId() ?? '';
    if (editing) {
      data['id'] = String(editing.id);
      data['updated_by'] = userId;
    } else {
      data['created_by'] = userId;
    }

    this.saving.set(true);
    try {
      const res = editing ? await this.service.update(data) : await this.service.create(data);
      if (res.success === false) throw new Error(res.message);
      this.alert.fire({
        title: 'Éxito',
        text: `${bloqueo ? 'Bloqueo' : 'Curso'} ${editing ? 'actualizado' : 'agendado'} correctamente.`,
        icon: 'success',
      });
      this.closeEventoModal();
      this.reload();
    } catch (error) {
      console.error('Error:', error);
      this.alert.fire({
        title: 'Error',
        text: (error as Error).message || 'Ocurrió un error inesperado',
        icon: 'error',
      });
    } finally {
      this.saving.set(false);
    }
  }

  // ===== Eliminar =====
  protected async deleteEvento(event: CalEvent): Promise<void> {
    const title = event.bloqueo ? '¿Eliminar bloqueo?' : '¿Eliminar curso agendado?';
    if (!(await this.alert.confirmDelete(title))) return;
    try {
      await this.service.delete(event.id, this.auth.getUserId());
      this.alert.fire({
        title: '¡Eliminado!',
        text: event.bloqueo ? 'El bloqueo fue eliminado.' : 'El curso fue eliminado del calendario.',
        icon: 'success',
      });
      if (this.editing()?.id === event.id) this.closeEventoModal();
      this.reload();
    } catch (error) {
      console.error('Error al eliminar:', error);
      this.alert.fire({
        title: 'Error',
        text: (error as Error).message || 'Ocurrió un error al eliminar.',
        icon: 'error',
      });
    }
  }
}

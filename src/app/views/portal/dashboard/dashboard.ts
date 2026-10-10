import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Balance } from '../../../components/balance/balance';
import { CalculadoraIva } from '../../../components/calculadora-iva/calculadora-iva';
import { formatYmd } from '../../../components/portal-utils';
import { CursosAgendadosService, CursoAgendado } from '../../../services/cursos-agendados.service';
import { TransferenciasService, Transferencia } from '../../../services/transferencias.service';
import { FacturasService, Factura } from '../../../services/facturas.service';

const MONEY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
type LoadState = 'loading' | 'ready' | 'error';

interface Agendado {
  raw: CursoAgendado;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  timeLabel: string;
}

/** Convierte `Y-m-d H:i:s` (hora local) a Date sin depender del parser del navegador. */
function parseDateTime(value: string): Date {
  const [d, t = '00:00:00'] = value.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [h, i] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h || 0, i || 0);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toNumber(value: unknown): number {
  return parseFloat(String(value ?? '')) || 0;
}

function toAgendado(raw: CursoAgendado): Agendado {
  const start = parseDateTime(raw.start_date);
  const end = parseDateTime(raw.end_date);
  const allDay = raw.all_day === true || String(raw.all_day) === '1';
  return {
    raw,
    title: raw.curso || 'Bloqueado',
    start,
    end,
    allDay,
    timeLabel: allDay ? 'Todo el día' : `${formatTime(start)} - ${formatTime(end)}`,
  };
}

/** Tablero de widgets con información rápida del portal administrativo. */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  imports: [RouterLink, Balance, CalculadoraIva],
})
export class Dashboard {
  private readonly cursosService = inject(CursosAgendadosService);
  private readonly transferenciasService = inject(TransferenciasService);
  private readonly facturasService = inject(FacturasService);

  private readonly today = addDays(new Date(), 0);

  protected readonly accesos = [
    { label: 'Nueva cotización', route: '/portal/cotizaciones', icon: 'fa-file-invoice-dollar', color: 'blue' },
    { label: 'Agregar cliente', route: '/portal/clientes', icon: 'fa-user-plus', color: 'green' },
    { label: 'Agendar curso', route: '/portal/calendario', icon: 'fa-calendar-plus', color: 'purple' },
    { label: 'Transferencia', route: '/portal/transferencias', icon: 'fa-money-bill-transfer', color: 'orange' },
  ];

  // ===== Cursos agendados (próximo curso) =====
  protected readonly cursosState = signal<LoadState>('loading');
  private readonly agendados = signal<Agendado[]>([]);

  /** Primer curso (no bloqueo) que aún no termina. */
  protected readonly proximoCurso = computed(() => {
    const now = new Date();
    return this.agendados().find((a) => a.raw.curso && a.end > now) ?? null;
  });

  protected readonly proximoCursoFecha = computed(() => {
    const c = this.proximoCurso();
    if (!c) return '';
    const d = c.start;
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  });

  // ===== Contadores =====
  protected readonly transferenciasState = signal<LoadState>('loading');
  private readonly transferenciasPendientes = signal<Transferencia[]>([]);
  protected readonly transferenciasCount = computed(() => this.transferenciasPendientes().length);
  protected readonly transferenciasTotal = computed(() =>
    MONEY.format(this.transferenciasPendientes().reduce((sum, t) => sum + toNumber(t.cantidad), 0)),
  );

  protected readonly facturasState = signal<LoadState>('loading');
  private readonly facturasPorCobrar = signal<Factura[]>([]);
  protected readonly facturasCount = computed(() => this.facturasPorCobrar().length);
  protected readonly facturasTotal = computed(() =>
    MONEY.format(this.facturasPorCobrar().reduce((sum, f) => sum + toNumber(f.total), 0)),
  );

  constructor() {
    this.loadCursos();
    this.loadTransferencias();
    this.loadFacturas();
  }

  // ===== Carga de datos (cada widget es independiente) =====
  private async loadCursos(): Promise<void> {
    try {
      const data = await this.cursosService.getAllByDate(
        formatYmd(this.today),
        formatYmd(addDays(this.today, 60)),
      );
      this.agendados.set(
        data.map(toAgendado).sort((a, b) => a.start.getTime() - b.start.getTime()),
      );
      this.cursosState.set('ready');
    } catch (error) {
      console.error('Error al cargar cursos agendados:', error);
      this.cursosState.set('error');
    }
  }

  private async loadTransferencias(): Promise<void> {
    try {
      const data = await this.transferenciasService.getAllByDate(
        formatYmd(addDays(this.today, -180)),
        formatYmd(this.today),
      );
      this.transferenciasPendientes.set(
        data.filter((t) => (t.status || 'pendiente').toLowerCase() === 'pendiente'),
      );
      this.transferenciasState.set('ready');
    } catch (error) {
      console.error('Error al cargar transferencias:', error);
      this.transferenciasState.set('error');
    }
  }

  private async loadFacturas(): Promise<void> {
    try {
      const data = await this.facturasService.getFacturas(
        formatYmd(addDays(this.today, -365)),
        formatYmd(this.today),
      );
      this.facturasPorCobrar.set(
        data.filter(
          (f) => String(f.pagada) !== '1' && (f['status_sat'] || 'Vigente').toLowerCase() === 'vigente',
        ),
      );
      this.facturasState.set('ready');
    } catch (error) {
      console.error('Error al cargar facturas:', error);
      this.facturasState.set('error');
    }
  }
}

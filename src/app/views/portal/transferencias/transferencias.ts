import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Instance } from 'flatpickr/dist/types/instance';
import { TransferenciasService, Transferencia } from '../../../services/transferencias.service';
import { AlertService } from '../../../services/alert.service';
import { AuthService } from '../../../services/auth.service';
import {
  AnimatedModal,
  SortDirection,
  createDateRangePicker,
  formatYmd,
  getSelectedRange,
  sortRows,
} from '../../../components/portal-utils';
import { Balance, MonthRange } from '../../../components/balance/balance';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DATE_COLUMNS = ['created_at', 'fecha_transferencia'];
const MONEY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

interface TransferenciaRow {
  transferencia: Transferencia;
  id: string | number;
  destino: string;
  descripcion: string;
  cantidad: string;
  status: string;
  statusClass: string;
  pendiente: boolean;
  /** Pendiente, o cualquier status si el usuario es sadmin. */
  editable: boolean;
  fechaSolicitud: string;
  fechaTransferencia: string;
}

function formatFecha(value?: string): string {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'N/A';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

@Component({
  selector: 'app-transferencias',
  templateUrl: './transferencias.html',
  styleUrl: './transferencias.scss',
  imports: [Balance],
})
export class Transferencias implements OnDestroy {
  private readonly service = inject(TransferenciasService);
  private readonly alert = inject(AlertService);
  private readonly auth = inject(AuthService);

  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateRangePicker');
  private readonly transferenciaForm =
    viewChild.required<ElementRef<HTMLFormElement>>('transferenciaForm');

  private picker?: Instance;

  /** sadmin puede marcar como transferido y editar/borrar en cualquier status. */
  protected readonly isSadmin = this.auth.getRole() === 'sadmin';

  // Tabla
  protected readonly transferencias = signal<Transferencia[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly sort = signal<{ column: string; direction: SortDirection }>({
    column: 'created_at',
    direction: 'desc',
  });

  protected readonly rows = computed<TransferenciaRow[]>(() => {
    const { column, direction } = this.sort();
    return sortRows(this.transferencias(), column, direction, ['id', 'cantidad'], DATE_COLUMNS).map(
      (t) => {
        const status = t.status || 'pendiente';
        const pendiente = status.toLowerCase() === 'pendiente';
        const cantidad = parseFloat(String(t.cantidad ?? ''));
        return {
          transferencia: t,
          id: t.id,
          destino: t.destino || 'N/A',
          descripcion: t.descripcion || '',
          cantidad: isNaN(cantidad) ? 'N/A' : MONEY.format(cantidad),
          status,
          statusClass: status.toLowerCase(),
          pendiente,
          editable: pendiente || this.isSadmin,
          fechaSolicitud: formatFecha(t.created_at),
          fechaTransferencia: formatFecha(t.fecha_transferencia),
        };
      },
    );
  });

  // Modal crear / editar
  protected readonly transferenciaModal = new AnimatedModal();
  protected readonly editMode = signal(false);
  protected readonly saving = signal(false);

  constructor() {
    afterNextRender(() => {
      this.picker = createDateRangePicker(this.dateInput().nativeElement, 1, () =>
        this.loadTransferencias(),
      );
      this.loadTransferencias();
    });
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
  }

  /** El balance cambió de mes: el rango del listado pasa a ese mes (onChange del picker recarga). */
  protected onMonthChange(range: MonthRange): void {
    this.picker?.setDate([range.start_date, range.end_date], true, 'Y-m-d');
  }

  protected async loadTransferencias(): Promise<void> {
    this.state.set('loading');

    let range = getSelectedRange(this.picker);
    if (!range) {
      // Rango por defecto: último mes
      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);
      range = { start: formatYmd(oneMonthAgo), end: formatYmd(today) };
    }

    try {
      this.transferencias.set(await this.service.getAllByDate(range.start, range.end));
      this.state.set('ready');
    } catch (error) {
      console.error('Error fetching transferencias:', error);
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

  // ===== Modal crear / editar =====
  protected openCreateModal(): void {
    this.editMode.set(false);
    this.transferenciaForm().nativeElement.reset();
    this.transferenciaModal.open();
  }

  protected openEditModal(row: TransferenciaRow): void {
    if (!row.editable) return;
    this.editMode.set(true);
    const t = row.transferencia;
    const form = this.transferenciaForm().nativeElement;
    const set = (name: string, value: unknown) =>
      ((form.elements.namedItem(name) as HTMLInputElement).value = String(value ?? ''));

    set('id', t.id);
    set('destino', t.destino);
    set('descripcion', t.descripcion);
    set('cantidad', t.cantidad);
    this.transferenciaModal.open();
  }

  protected closeTransferenciaModal(): void {
    this.transferenciaModal.close();
  }

  protected async submitTransferencia(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const editing = this.editMode();
    const userId = this.auth.getUserId() ?? '';

    if (editing) {
      formData.append('updated_by', userId);
    } else {
      formData.delete('id');
      formData.append('created_by', userId);
    }

    this.saving.set(true);
    try {
      const data = editing
        ? await this.service.update(formData)
        : await this.service.create(formData);

      if (data.success) {
        this.alert.fire({
          title: 'Éxito',
          text: editing
            ? 'Transferencia actualizada correctamente.'
            : 'Transferencia creada correctamente.',
          icon: 'success',
        });
        this.closeTransferenciaModal();
        this.loadTransferencias();
      } else {
        this.alert.fire({
          title: 'Error',
          text:
            data.message ||
            (editing ? 'Error al actualizar la transferencia' : 'Error al crear la transferencia'),
          icon: 'error',
        });
      }
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

  // ===== Marcar como transferido (sadmin) =====
  protected async markTransferido(row: TransferenciaRow): Promise<void> {
    if (!this.isSadmin || !row.pendiente) return;
    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Marcar como transferido?',
      text: `${row.cantidad} para ${row.destino}. Ya no se podrá editar ni eliminar.`,
      showCancelButton: true,
      confirmButtonColor: '#2ed573',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, transferido',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
      await this.service.setTransferido(row.id);
      this.alert.fire({
        title: 'Éxito',
        text: 'La transferencia fue marcada como transferida.',
        icon: 'success',
      });
      this.loadTransferencias();
    } catch (error) {
      console.error('Error al marcar transferencia:', error);
      this.alert.fire({
        title: 'Error',
        text: (error as Error).message || 'Ocurrió un error al actualizar el status.',
        icon: 'error',
      });
    }
  }

  // ===== Eliminar =====
  protected async deleteTransferencia(row: TransferenciaRow): Promise<void> {
    if (!row.editable) return;
    if (!(await this.alert.confirmDelete('¿Eliminar transferencia?'))) return;
    try {
      await this.service.delete(row.id, this.auth.getUserId());
      this.alert.fire({
        title: '¡Eliminada!',
        text: 'La transferencia fue eliminada correctamente.',
        icon: 'success',
      });
      this.loadTransferencias();
    } catch (error) {
      console.error('Error al eliminar transferencia:', error);
      this.alert.fire({
        title: 'Error',
        text: (error as Error).message || 'Ocurrió un error al eliminar la transferencia.',
        icon: 'error',
      });
    }
  }
}

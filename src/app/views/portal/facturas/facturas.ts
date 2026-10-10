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
import { FacturasService, Factura } from '../../../services/facturas.service';
import { AlertService } from '../../../services/alert.service';
import {
  SortDirection,
  createDateRangePicker,
  downloadBlob,
  getSelectedRange,
  sortRows,
} from '../../../components/portal-utils';
import { Balance, MonthRange } from '../../../components/balance/balance';

type FileKind = 'pdf' | 'xml';

interface FacturaRow {
  factura: Factura;
  uuid: string;
  folio: string;
  fecha: string;
  receptor: string;
  subtotal: string;
  total: string;
  utilidadNeta: string;
  isPagada: boolean;
  isEnviada: boolean;
}

const NUMERIC_COLUMNS = ['total', 'subtotal', 'utilidad_neta', 'iva', 'isr_retenido', 'iva_retenido'];

/** Utilidad neta = subtotal - (total * 3%) */
function calcUtilidadNeta(f: Factura): number {
  const subtotal = parseFloat(String(f.subtotal)) || 0;
  const total = parseFloat(String(f.total)) || 0;
  return subtotal - total * 0.03;
}

@Component({
  selector: 'app-facturas',
  templateUrl: './facturas.html',
  imports: [Balance],
})
export class Facturas implements OnDestroy {
  private readonly service = inject(FacturasService);
  private readonly alert = inject(AlertService);

  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateRangePicker');
  private readonly pdfInput = viewChild.required<ElementRef<HTMLInputElement>>('pdfFileInput');
  private readonly xmlInput = viewChild.required<ElementRef<HTMLInputElement>>('xmlFileInput');

  private picker?: Instance;

  // Tabla
  protected readonly facturas = signal<Factura[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly search = signal('');
  protected readonly sort = signal<{ column: string; direction: SortDirection }>({
    column: 'fecha_emision',
    direction: 'desc',
  });

  protected readonly rows = computed<FacturaRow[]>(() => {
    const { column, direction } = this.sort();
    const withUtilidad = this.facturas().map((f) => ({ ...f, utilidad_neta: calcUtilidadNeta(f) }));
    let data = sortRows(withUtilidad, column, direction, NUMERIC_COLUMNS, ['fecha_emision']);

    const term = this.search().toLowerCase().trim();
    if (term) {
      data = data.filter((f) => {
        const rfc = (f.receptor_rfc || '').toLowerCase();
        const razon = (f.receptor_nombre || '').toLowerCase();
        return rfc.includes(term) || razon.includes(term);
      });
    }

    return data.map((factura) => {
      const moneda = factura.moneda || 'MXN';
      const fmt = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(val || 0);
      return {
        factura,
        uuid: String(factura.uuid_fiscal || factura.id),
        folio: `${factura.serie || ''}${factura.folio || ''}` || 'N/A',
        fecha: factura.fecha_emision
          ? new Date(factura.fecha_emision).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : 'N/A',
        receptor: factura.receptor_nombre || 'N/A',
        subtotal: fmt(parseFloat(String(factura.subtotal)) || 0),
        total: fmt(parseFloat(String(factura.total)) || 0),
        utilidadNeta: fmt(factura.utilidad_neta),
        isPagada: factura.pagada == 1,
        isEnviada: factura.enviada == 1,
      };
    });
  });

  protected readonly totals = computed(() => {
    const fmt = (val: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    let subtotal = 0;
    let total = 0;
    let utilidadNeta = 0;
    for (const { factura } of this.rows()) {
      subtotal += parseFloat(String(factura.subtotal)) || 0;
      total += parseFloat(String(factura.total)) || 0;
      utilidadNeta += calcUtilidadNeta(factura);
    }
    return { subtotal: fmt(subtotal), total: fmt(total), utilidadNeta: fmt(utilidadNeta) };
  });

  // Modal agregar factura
  protected readonly addModalOpen = signal(false);
  protected readonly files = signal<Record<FileKind, File | null>>({ pdf: null, xml: null });
  protected readonly dragOver = signal<FileKind | null>(null);
  protected readonly saving = signal(false);

  // Modal enviar factura
  protected readonly sendModalOpen = signal(false);
  protected readonly sending = signal(false);
  protected readonly sendUuid = signal('');
  protected readonly sendNombre = signal('');
  protected readonly sendEmail = signal('');
  protected readonly sendMensaje = signal('');

  constructor() {
    afterNextRender(() => {
      this.picker = createDateRangePicker(this.dateInput().nativeElement, 'currentMonth', () =>
        this.loadFacturas(),
      );
      this.loadFacturas();
    });
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
  }

  /** El balance cambió de mes: el rango del listado pasa a ese mes (onChange del picker recarga). */
  protected onMonthChange(range: MonthRange): void {
    this.picker?.setDate([range.start_date, range.end_date], true, 'Y-m-d');
  }

  protected async loadFacturas(): Promise<void> {
    this.state.set('loading');
    const range = getSelectedRange(this.picker);
    if (!range) return;

    try {
      let data = await this.service.getFacturas(range.start, range.end);

      // Filtro en frontend como respaldo en caso de que el backend ignore el rango
      const startDate = new Date(range.start + 'T00:00:00');
      const endDate = new Date(range.end + 'T23:59:59.999');
      data = data.filter((f) => {
        if (!f.fecha_emision) return true;
        const fDate = new Date(f.fecha_emision);
        return fDate >= startDate && fDate <= endDate;
      });

      this.facturas.set(data);
      this.state.set('ready');
    } catch (error) {
      console.error('Error fetching facturas:', error);
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

  // ===== Acciones =====
  protected async downloadXML(uuid: string): Promise<void> {
    try {
      downloadBlob(await this.service.downloadXml(uuid), `factura_${uuid}.xml`);
    } catch (error) {
      this.alert.showError(new Error('Error al descargar el XML'), 'Error al descargar el XML');
    }
  }

  protected async downloadPDF(uuid: string): Promise<void> {
    try {
      downloadBlob(await this.service.downloadPdf(uuid), `factura_${uuid}.pdf`);
    } catch (error) {
      this.alert.showError(new Error('Error al descargar el PDF'), 'Error al descargar el PDF');
    }
  }

  protected async togglePagada(row: FacturaRow): Promise<void> {
    try {
      // La transacción de CCAPSI va antes de set_pagada
      const utilidadNeta = calcUtilidadNeta(row.factura);
      if (row.isPagada) {
        await this.service.borrarTransaccion(row.folio, utilidadNeta);
      } else {
        await this.service.crearTransaccion(row.folio, utilidadNeta);
      }
      await this.service.setPagada(row.uuid, row.isPagada ? 0 : 1);
      this.alert.showSuccess('¡Éxito!', 'Estado de pago actualizado.');
    } catch (error) {
      this.alert.showError(error, 'Error al actualizar estado de pago');
    }
    this.loadFacturas();
  }

  protected async deleteFactura(row: FacturaRow): Promise<void> {
    if (!(await this.alert.confirmDelete('¿Eliminar factura?'))) return;
    try {
      // Primero se marca como no pagada (transacción de CCAPSI y set_pagada);
      // si algo falla se lanza el error y la factura no se borra
      if (row.isPagada) {
        await this.service.borrarTransaccion(row.folio, calcUtilidadNeta(row.factura));
        await this.service.setPagada(row.uuid, 0);
      }
      await this.service.delete(row.uuid);
      this.alert.showSuccess('¡Eliminada!', 'La factura fue eliminada correctamente.');
    } catch (error) {
      this.alert.showError(error, 'Error al eliminar la factura');
    }
    // También si falla: puede haber quedado como no pagada antes del error
    this.loadFacturas();
  }

  // ===== Modal enviar factura =====
  protected enviarFactura(row: FacturaRow): void {
    this.sendUuid.set(row.uuid);
    this.sendNombre.set(row.factura.receptor_nombre || '');
    this.sendEmail.set('');
    this.sendMensaje.set('');
    this.sendModalOpen.set(true);
  }

  protected closeSendModal(): void {
    this.sendModalOpen.set(false);
  }

  protected async confirmEnviarFactura(): Promise<void> {
    if (!this.sendEmail().trim()) {
      this.alert.showError(new Error('El correo electrónico es obligatorio.'), 'Validación fallida');
      return;
    }

    this.sending.set(true);
    try {
      await this.service.sendFactura(
        this.sendUuid(),
        this.sendNombre(),
        this.sendEmail(),
        this.sendMensaje(),
      );
      this.alert.showSuccess('¡Éxito!', 'Factura enviada correctamente.');
      this.closeSendModal();
      this.loadFacturas();
    } catch (error) {
      this.alert.showError(error, 'Error al enviar la factura');
    } finally {
      this.sending.set(false);
    }
  }

  // ===== Modal agregar factura =====
  protected openAddModal(): void {
    this.addModalOpen.set(true);
  }

  protected closeAddModal(): void {
    this.addModalOpen.set(false);
    this.clearFile('pdf');
    this.clearFile('xml');
  }

  protected openFilePicker(kind: FileKind): void {
    (kind === 'pdf' ? this.pdfInput() : this.xmlInput()).nativeElement.click();
  }

  protected onFileSelected(kind: FileKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) this.handleFile(kind, input.files[0]);
  }

  protected onDragOver(kind: FileKind, event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(kind);
  }

  protected onDrop(kind: FileKind, event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(null);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) this.handleFile(kind, files[0]);
  }

  protected removeFile(kind: FileKind, event: Event): void {
    event.stopPropagation();
    this.clearFile(kind);
  }

  private handleFile(kind: FileKind, file: File): void {
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    if (ext !== `.${kind}`) {
      alert(`Solo se permiten archivos ${kind.toUpperCase()}`);
      return;
    }
    this.files.update((f) => ({ ...f, [kind]: file }));
  }

  private clearFile(kind: FileKind): void {
    (kind === 'pdf' ? this.pdfInput() : this.xmlInput()).nativeElement.value = '';
    this.files.update((f) => ({ ...f, [kind]: null }));
  }

  protected async saveFactura(): Promise<void> {
    const { xml, pdf } = this.files();
    if (!xml || !pdf) return;

    this.saving.set(true);
    try {
      await this.service.create(xml, pdf);
      this.closeAddModal();
      this.alert.showSuccess('¡Éxito!', 'Factura guardada correctamente');
      this.loadFacturas();
    } catch (error) {
      console.error('Error al guardar la factura', error);
      this.alert.showError(error, 'Error al guardar la factura');
    } finally {
      this.saving.set(false);
    }
  }
}

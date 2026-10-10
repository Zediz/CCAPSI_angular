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
import Quill from 'quill';
import { Instance } from 'flatpickr/dist/types/instance';
import { CotizacionesService, Cotizacion } from '../../../services/cotizaciones.service';
import { AlertService } from '../../../services/alert.service';
import { ApiError } from '../../../services/api.service';
import { ClientesService, Cliente } from '../../../services/clientes.service';
import { CourseOption } from '../../../models/course';
import {
  AnimatedModal,
  SortDirection,
  createDateRangePicker,
  formatYmd,
  getSelectedRange,
  sortRows,
} from '../../../components/portal-utils';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DEFAULT_DROP_TEXT = 'Haz clic o arrastra un archivo aquí para adjuntar';

/** Texto plano guardado (cotizacion.mensaje) a HTML para mostrarlo en el editor. */
function textoAHtml(texto: string): string {
  const escapado = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escapado.trim() ? escapado.replace(/\n/g, '<br>') : '';
}

function mensajePorDefecto(nombre: string): string {
  return `Hola ${nombre},<br><br>Adjunto encontrarás la cotización solicitada.<br><br>Saludos.`;
}

interface CotizacionRow {
  cotizacion: Cotizacion;
  fecha: string;
  nombre: string;
  curso: string;
  /** Primer correo; `emailsTodos` conserva la lista completa para el tooltip. */
  email: string;
  emailsTodos: string;
  whatsapp: string;
  whatsappDigits: string;
  mensaje: string;
  enviado: boolean;
  /** Tiene archivo registrado, o fue enviada (los envíos anteriores guardaban el archivo sin registrarlo). */
  tieneArchivo: boolean;
}

@Component({
  selector: 'app-cotizaciones',
  templateUrl: './cotizaciones.html',
  styleUrl: './cotizaciones.scss',
})
export class Cotizaciones implements OnDestroy {
  private readonly service = inject(CotizacionesService);
  private readonly alert = inject(AlertService);
  private readonly clientesService = inject(ClientesService);

  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateRangePicker');
  private readonly editorEl = viewChild.required<ElementRef<HTMLElement>>('emailMessageEditor');
  private readonly sendEmailForm = viewChild.required<ElementRef<HTMLFormElement>>('sendEmailForm');
  private readonly attachmentInput = viewChild.required<ElementRef<HTMLInputElement>>('emailAttachment');

  private picker?: Instance;
  private quill?: Quill;

  // Tabla
  protected readonly cotizaciones = signal<Cotizacion[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly sort = signal<{ column: string; direction: SortDirection }>({
    column: 'created_at',
    direction: 'desc',
  });

  protected readonly rows = computed<CotizacionRow[]>(() => {
    const { column, direction } = this.sort();
    return sortRows(this.cotizaciones(), column, direction, [], ['created_at']).map((c) => {
      const d = c.created_at ? new Date(c.created_at) : null;
      const whatsapp = c.whatsapp || 'N/A';
      const status = c.status || 'Pendiente';
      return {
        cotizacion: c,
        fecha: d
          ? `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`
          : 'N/A',
        nombre: c.nombre || 'N/A',
        curso: c.course_name || c.course_title || c.course_uuid || 'N/A',
        email: (c.email || '').split(',')[0].trim() || 'N/A',
        emailsTodos: c.email || '',
        whatsapp,
        whatsappDigits: whatsapp.replace(/[^0-9]/g, ''),
        mensaje: c.mensaje || '',
        enviado: status.toLowerCase() === 'enviado',
        tieneArchivo: !!c['archivo_url'] || status.toLowerCase() === 'enviado',
      };
    });
  });

  // Clientes registrados para el modal de envío, por razón social
  private readonly clientes = signal<Cliente[]>([]);
  protected readonly clientesState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly clientesOrdenados = computed(() =>
    [...this.clientes()].sort((a, b) =>
      (a.razon_social || '').localeCompare(b.razon_social || '', 'es', { sensitivity: 'base' }),
    ),
  );
  protected readonly clienteNuevo = signal(false);

  // Opciones de cursos (sugerencias del input de curso)
  protected readonly courseOptions = signal<CourseOption[]>([]);
  protected readonly optionsState = signal<'loading' | 'ready' | 'empty' | 'error'>('loading');

  /**
   * Modal de cotización: 'nueva' la crea al enviar, 'existente' reenvía una registrada y
   * 'ver' muestra la información sin poder editarla.
   */
  protected readonly emailModal = new AnimatedModal();
  protected readonly sendMode = signal<'nueva' | 'existente' | 'ver'>('nueva');
  protected readonly soloLectura = computed(() => this.sendMode() === 'ver');
  /** Fila mostrada en modo 'ver', para pasar a reenviarla. */
  private viewRow: CotizacionRow | null = null;
  /** Mientras el usuario no edite el mensaje, el saludo sigue al nombre del cliente. */
  private messageTouched = false;
  /** Cotización que se reenvía y nombre del archivo que tiene guardado. */
  private reenvioId: string | number | null = null;
  protected readonly archivoGuardado = signal('');
  protected readonly sendingEmail = signal(false);
  protected readonly attachmentName = signal('');
  protected readonly dropHover = signal(false);

  constructor() {
    this.loadCourseSelectOptions();
    this.loadClientes();

    afterNextRender(() => {
      this.picker = createDateRangePicker(this.dateInput().nativeElement, 3, () =>
        this.loadCotizaciones(),
      );

      this.quill = new Quill(this.editorEl().nativeElement, {
        theme: 'snow',
        modules: {
          toolbar: [['bold'], [{ list: 'bullet' }], [{ align: [] }]],
        },
        placeholder: 'Escribe el mensaje aquí...',
      });
      this.quill.on('text-change', (_delta, _old, source) => {
        if (source === 'user') this.messageTouched = true;
      });

      this.loadCotizaciones();
    });
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
  }

  protected async loadCotizaciones(): Promise<void> {
    this.state.set('loading');

    let range = getSelectedRange(this.picker);
    if (!range) {
      // Rango por defecto: últimos 3 meses
      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      range = { start: formatYmd(threeMonthsAgo), end: formatYmd(today) };
    }

    try {
      this.cotizaciones.set(await this.service.getCotizaciones(range.start, range.end));
      this.state.set('ready');
    } catch (error) {
      console.error('Error fetching cotizaciones:', error);
      this.state.set('error');
    }
  }

  private async loadCourseSelectOptions(): Promise<void> {
    try {
      const options = await this.service.getCourseOptions();
      this.courseOptions.set(options);
      this.optionsState.set(options.length ? 'ready' : 'empty');
    } catch (error) {
      console.error('Error al cargar cursos:', error);
      this.optionsState.set('error');
    }
  }

  private async loadClientes(): Promise<void> {
    try {
      this.clientes.set(await this.clientesService.select());
      this.clientesState.set('ready');
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      this.clientesState.set('error');
    }
  }

  protected optionLabel(opt: CourseOption): string {
    return opt.title || opt.name || opt.nombre || 'Curso';
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

  // ===== Modal crear y enviar =====
  /** "Nueva Cotización": la cotización se crea y se envía al dar clic en Enviar. */
  protected openNewSendModal(): void {
    this.reenvioId = null;
    this.archivoGuardado.set('');
    this.prepareSendModal('nueva', {});
  }

  /** Reenvía una cotización ya registrada; si no se adjunta otro archivo se usa el guardado. */
  protected openSendEmailModal(row: CotizacionRow): void {
    this.openRowModal('existente', row);
  }

  /** Clic en la fila: la cotización en modo solo lectura. */
  protected openViewModal(row: CotizacionRow): void {
    this.openRowModal('ver', row);
  }

  protected reenviarDesdeVista(): void {
    if (this.viewRow) this.prepareSendModal('existente', this.rowValues(this.viewRow));
  }

  private openRowModal(mode: 'existente' | 'ver', row: CotizacionRow): void {
    this.viewRow = row;
    this.reenvioId = row.cotizacion.id;
    this.archivoGuardado.set(row.cotizacion['archivo_nombre'] || '');
    this.prepareSendModal(mode, this.rowValues(row));
  }

  private rowValues(row: CotizacionRow): Record<string, unknown> {
    const c = row.cotizacion;
    return {
      cotizacion_id: c.id,
      curso: c.course_name,
      nombre: c.nombre,
      empresa: c.empresa,
      emails: c.email,
      whatsapp: c.whatsapp,
      mensaje: c.mensaje,
    };
  }

  private prepareSendModal(mode: 'nueva' | 'existente' | 'ver', values: Record<string, unknown>): void {
    this.sendMode.set(mode);
    this.clienteNuevo.set(false);
    const form = this.sendEmailForm().nativeElement;
    form.reset();
    for (const name of ['cotizacion_id', 'curso', 'nombre', 'empresa', 'emails', 'whatsapp']) {
      this.setSendField(name, values[name]);
    }

    this.messageTouched = false;
    if (this.quill) {
      // En modo 'ver' se muestra el mensaje guardado de la cotización. Se carga con la API de
      // Quill (con el editor habilitado) para que actualice su estado y oculte el placeholder.
      const html =
        mode === 'ver'
          ? textoAHtml(String(values['mensaje'] ?? '')) || '<em>Sin mensaje</em>'
          : mensajePorDefecto(String(values['nombre'] ?? ''));
      this.quill.enable(true);
      this.quill.setContents([]);
      this.quill.clipboard.dangerouslyPasteHTML(html, 'api');
      this.quill.enable(mode !== 'ver');
    }

    this.attachmentInput().nativeElement.value = '';
    this.attachmentName.set('');
    this.emailModal.open();
  }

  private setSendField(name: string, value: unknown): void {
    const form = this.sendEmailForm().nativeElement;
    (form.elements.namedItem(name) as HTMLInputElement).value = String(value ?? '');
  }

  /** Datos del cliente en el formulario de envío (vacío = el usuario los captura). */
  private fillCliente(c: Partial<Cliente>): void {
    this.setSendField('nombre', c.contacto_1_nombre);
    this.setSendField('empresa', c.razon_social);
    this.setSendField('emails', c.contacto_1_correo);
    this.setSendField('whatsapp', c.contacto_1_telefono);
    this.updateGreeting(c.contacto_1_nombre || '');
  }

  protected onClienteNuevoChange(event: Event): void {
    this.clienteNuevo.set((event.target as HTMLInputElement).checked);
    this.fillCliente({});
  }

  protected onClienteSelected(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.fillCliente(this.clientes().find((c) => String(c.id) === id) ?? {});
  }

  // ===== Archivo adjunto guardado =====
  /** Abre el archivo en una pestaña nueva (el navegador muestra el PDF). */
  protected async verArchivo(id: string | number): Promise<void> {
    // La pestaña se abre antes del await para que el navegador no la bloquee como popup
    const tab = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await this.service.downloadArchivo(id));
      if (tab) {
        tab.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      this.alertArchivoError(error);
    }
  }

  protected verArchivoGuardado(): void {
    if (this.reenvioId != null) this.verArchivo(this.reenvioId);
  }

  private alertArchivoError(error: unknown): void {
    const sinArchivo = error instanceof ApiError && error.status === 404;
    this.alert.fire({
      title: sinArchivo ? 'Sin archivo guardado' : 'Error',
      text: sinArchivo
        ? 'Esta cotización no tiene un archivo guardado; adjunta uno al reenviarla.'
        : 'No se pudo obtener el archivo.',
      icon: sinArchivo ? 'info' : 'error',
    });
  }

  protected onNombreInput(event: Event): void {
    this.updateGreeting((event.target as HTMLInputElement).value.trim());
  }

  private updateGreeting(nombre: string): void {
    if (!this.messageTouched && this.quill) {
      this.quill.root.innerHTML = mensajePorDefecto(nombre);
    }
  }

  protected closeSendEmailModal(): void {
    this.emailModal.close(() => {
      this.sendEmailForm().nativeElement.reset();
      this.attachmentName.set('');
      this.dropHover.set(false);
    });
  }

  protected openAttachmentPicker(): void {
    this.attachmentInput().nativeElement.click();
  }

  protected onAttachmentDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dropHover.set(true);
  }

  protected onAttachmentDrop(event: DragEvent): void {
    event.preventDefault();
    this.dropHover.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.attachmentInput().nativeElement.files = files;
      this.attachmentName.set(files[0].name);
    }
  }

  protected onAttachmentSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.attachmentName.set(file.name);
  }

  protected async submitSendEmail(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!this.quill || !this.quill.getText().trim()) {
      this.alert.fire({ title: 'Falta el mensaje', text: 'Escribe el mensaje del correo.', icon: 'warning' });
      return;
    }

    // Los campos deshabilitados (cotización existente) no se incluyen en el FormData
    const formData = new FormData(event.target as HTMLFormElement);
    formData.set('message', this.quill.root.innerHTML);
    const nueva = this.sendMode() === 'nueva';

    this.sendingEmail.set(true);
    try {
      const data = await this.service.sendCotizacion(formData);

      if (data.success) {
        this.alert.fire({
          title: 'Éxito',
          text: nueva ? 'Cotización enviada y guardada correctamente.' : 'Cotización reenviada correctamente.',
          icon: 'success',
        });
        this.closeSendEmailModal();
        this.loadCotizaciones();
      } else {
        this.alert.fire({
          title: 'Error',
          text: data.message || 'Error al enviar el correo',
          icon: 'error',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      this.alert.fire({
        title: 'Error',
        text: (error as Error).message || 'Ocurrió un error inesperado al enviar',
        icon: 'error',
      });
    } finally {
      this.sendingEmail.set(false);
    }
  }

  protected readonly defaultDropText = DEFAULT_DROP_TEXT;
}

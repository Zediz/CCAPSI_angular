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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Instance } from 'flatpickr/dist/types/instance';
import { EmailsService, Email } from '../../../services/emails.service';
import { AlertService } from '../../../services/alert.service';
import {
  AnimatedModal,
  SortDirection,
  createDateRangePicker,
  getSelectedRange,
  sortRows,
} from '../../../components/portal-utils';

interface EmailRow {
  email: Email;
  id: string | number;
  recibido: string;
  remitente: string;
  fromEmail: string;
  asunto: string;
  para: string;
  hasAttachments: boolean;
  isReplied: boolean;
}

/** MySQL manda "YYYY-MM-DD HH:MM:SS"; Safari necesita la "T" para interpretarlo. */
function formatFecha(fecha?: string | null): string {
  if (!fecha) return 'N/A';
  return new Date(fecha.replace(' ', 'T')).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Component({
  selector: 'app-emails',
  templateUrl: './emails.html',
  styleUrl: './emails.scss',
})
export class Emails implements OnDestroy {
  private readonly service = inject(EmailsService);
  private readonly alert = inject(AlertService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateRangePicker');

  private picker?: Instance;

  // Tabla
  protected readonly emails = signal<Email[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly search = signal('');
  protected readonly sort = signal<{ column: string; direction: SortDirection }>({
    column: 'received_at',
    direction: 'desc',
  });

  protected readonly rows = computed<EmailRow[]>(() => {
    const { column, direction } = this.sort();
    let data = sortRows(this.emails(), column, direction, ['is_replied'], ['received_at']);

    const term = this.search().toLowerCase().trim();
    if (term) {
      data = data.filter((e) =>
        [e.from_name, e.from_email, e.subject].some((v) => (v || '').toLowerCase().includes(term)),
      );
    }

    return data.map((email) => ({
      email,
      id: email.id,
      recibido: formatFecha(email.received_at),
      remitente: email.from_name || email.from_email || 'N/A',
      fromEmail: email.from_name ? email.from_email || '' : '',
      asunto: email.subject || '(Sin asunto)',
      para: email.to_email || '',
      hasAttachments: email.has_attachments == 1,
      isReplied: email.is_replied == 1,
    }));
  });

  // Modal ver correo
  protected readonly emailModal = new AnimatedModal();
  protected readonly selected = signal<Email | null>(null);
  protected readonly loadingEmail = signal(false);

  protected readonly selectedView = computed(() => {
    const email = this.selected();
    if (!email) return null;
    return {
      id: email.id,
      asunto: email.subject || '(Sin asunto)',
      de: `${email.from_name || ''} <${email.from_email || ''}>`.trim(),
      para: `${email.to_name || ''} <${email.to_email || ''}>`.trim(),
      recibido: formatFecha(email.received_at),
      respondido: formatFecha(email.replied_at),
      isReplied: email.is_replied == 1,
      html: email.body_html ? this.buildEmailDocument(email.body_html) : null,
      text: email.body_text || '',
    };
  });

  constructor() {
    afterNextRender(() => {
      this.picker = createDateRangePicker(this.dateInput().nativeElement, 1, () => this.loadEmails());
      this.loadEmails();
    });
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
  }

  protected async loadEmails(): Promise<void> {
    this.state.set('loading');
    const range = getSelectedRange(this.picker);
    if (!range) return;

    try {
      this.emails.set(await this.service.getEmails(range.start, range.end));
      this.state.set('ready');
    } catch (error) {
      console.error('Error fetching emails:', error);
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

  // ===== Modal ver correo =====
  protected async openEmail(row: EmailRow): Promise<void> {
    // El listado no trae el cuerpo: se abre con los datos de la fila y se completa al llegar.
    this.selected.set(row.email);
    this.loadingEmail.set(true);
    this.emailModal.open();

    try {
      const full = await this.service.selectById(row.id);
      // Si ya cerraron el modal o abrieron otro correo, se descarta esta respuesta.
      const current = this.selected();
      if (current?.id != row.id) return;
      // is_replied pudo cambiar mientras cargaba el cuerpo; se conserva el estado actual.
      this.selected.set({ ...full, is_replied: current.is_replied, replied_at: current.replied_at });
    } catch (error) {
      this.alert.showError(error, 'Error al cargar el correo');
    } finally {
      this.loadingEmail.set(false);
    }
  }

  protected closeEmail(): void {
    this.emailModal.close(() => this.selected.set(null));
  }

  protected async toggleResponded(id: string | number): Promise<void> {
    try {
      const estado = await this.service.toggleResponded(id);
      this.emails.update((list) => list.map((e) => (e.id == id ? { ...e, ...estado } : e)));
      this.selected.update((e) => (e && e.id == id ? { ...e, ...estado } : e));
    } catch (error) {
      this.alert.showError(error, 'Error al actualizar el correo');
    }
  }

  /**
   * El HTML del correo viene de terceros: se muestra dentro de un iframe con sandbox (sin scripts ni
   * acceso a la sesión del portal), por eso aquí se puede saltar el sanitizer de Angular, que le
   * quitaría los estilos. El <base> hace que los enlaces abran en otra pestaña.
   */
  private buildEmailDocument(html: string): SafeHtml {
    const head =
      '<base target="_blank"><style>body{margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;' +
      'color:#1e293b;background:#fff;word-break:break-word;}img{max-width:100%;height:auto;}</style>';
    return this.sanitizer.bypassSecurityTrustHtml(head + html);
  }
}

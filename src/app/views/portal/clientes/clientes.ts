import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  ClientesService,
  Cliente,
  ContactoCliente,
  getContactos,
} from '../../../services/clientes.service';
import { REGIMENES_FISCALES, getRegimenFiscal } from '../../../Constants';
import { AlertService } from '../../../services/alert.service';
import { AuthService } from '../../../services/auth.service';
import { AnimatedModal, SortDirection, sortRows } from '../../../components/portal-utils';

const PAISES = ['México', 'Estados Unidos', 'Canadá'];

interface ClienteRow {
  cliente: Cliente;
  id: string | number;
  rfc: string;
  razonSocial: string;
  regimen: string;
  regimenDescripcion: string;
  ubicacion: string;
  contactos: ContactoCliente[];
  contactoPrincipal: ContactoCliente | null;
  /** Texto en minúsculas para la búsqueda. */
  search: string;
}

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.html',
  styleUrl: './clientes.scss',
})
export class Clientes {
  private readonly service = inject(ClientesService);
  private readonly alert = inject(AlertService);
  private readonly auth = inject(AuthService);

  private readonly clienteForm = viewChild.required<ElementRef<HTMLFormElement>>('clienteForm');

  protected readonly regimenes = REGIMENES_FISCALES;
  protected readonly paises = PAISES;
  protected readonly contactoSlots = [1, 2, 3];

  // Tabla
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly searchTerm = signal('');
  protected readonly sort = signal<{ column: string; direction: SortDirection }>({
    column: 'razon_social',
    direction: 'asc',
  });

  protected readonly rows = computed<ClienteRow[]>(() => {
    const { column, direction } = this.sort();
    const term = this.searchTerm().trim().toLowerCase();
    return sortRows(this.clientes(), column, direction, ['id'])
      .map((c) => {
        const contactos = getContactos(c);
        const ubicacion = [c.municipio, c.estado, c.pais].filter(Boolean).join(', ');
        return {
          cliente: c,
          id: c.id,
          rfc: c.rfc,
          razonSocial: c.razon_social || 'N/A',
          regimen: c.regimen_fiscal || '',
          regimenDescripcion: getRegimenFiscal(c.regimen_fiscal),
          ubicacion,
          contactos,
          contactoPrincipal: contactos[0] ?? null,
          search: [c.rfc, c.razon_social, c.regimen_fiscal, getRegimenFiscal(c.regimen_fiscal), ubicacion, ...contactos.flatMap((x) => [x.nombre, x.correo, x.telefono])]
            .join(' ')
            .toLowerCase(),
        };
      })
      .filter((row) => !term || row.search.includes(term));
  });

  // Modal crear / editar
  protected readonly clienteModal = new AnimatedModal();
  protected readonly editMode = signal(false);
  protected readonly saving = signal(false);

  // Modal de contactos
  protected readonly contactosModal = new AnimatedModal();
  protected readonly contactosRow = signal<ClienteRow | null>(null);

  constructor() {
    this.loadClientes();
  }

  protected async loadClientes(): Promise<void> {
    this.state.set('loading');
    try {
      this.clientes.set(await this.service.select());
      this.state.set('ready');
    } catch (error) {
      console.error('Error fetching clientes:', error);
      this.state.set('error');
    }
  }

  protected onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
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

  // ===== Modal de contactos =====
  protected openContactosModal(row: ClienteRow): void {
    this.contactosRow.set(row);
    this.contactosModal.open();
  }

  protected closeContactosModal(): void {
    this.contactosModal.close(() => this.contactosRow.set(null));
  }

  // ===== Modal crear / editar =====
  protected openCreateModal(): void {
    this.editMode.set(false);
    this.clienteForm().nativeElement.reset();
    this.clienteModal.open();
  }

  protected openEditModal(row: ClienteRow): void {
    this.editMode.set(true);
    const c = row.cliente;
    const form = this.clienteForm().nativeElement;
    form.reset();
    for (const element of Array.from(form.elements)) {
      const field = element as HTMLInputElement | HTMLSelectElement;
      if (field.name) field.value = String(c[field.name] ?? '');
    }
    this.clienteModal.open();
  }

  protected closeClienteModal(): void {
    this.clienteModal.close();
  }

  protected async submitCliente(event: SubmitEvent): Promise<void> {
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
          text: editing ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.',
          icon: 'success',
        });
        this.closeClienteModal();
        this.loadClientes();
      } else {
        this.alert.fire({
          title: 'Error',
          text: data.message || (editing ? 'Error al actualizar el cliente' : 'Error al crear el cliente'),
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

  // ===== Eliminar =====
  protected async deleteCliente(row: ClienteRow): Promise<void> {
    if (!(await this.alert.confirmDelete(`¿Eliminar a ${row.razonSocial}?`))) return;
    try {
      await this.service.delete(row.id, this.auth.getUserId());
      this.alert.fire({
        title: '¡Eliminado!',
        text: 'El cliente fue eliminado correctamente.',
        icon: 'success',
      });
      this.loadClientes();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      this.alert.fire({
        title: 'Error',
        text: (error as Error).message || 'Ocurrió un error al eliminar el cliente.',
        icon: 'error',
      });
    }
  }
}

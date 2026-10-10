import { Injectable, inject } from '@angular/core';
import { ApiService, extractList } from './api.service';

export interface Cliente {
  id: string | number;
  rfc: string;
  razon_social: string;
  curp?: string | null;
  regimen_fiscal?: string | null;
  pais?: string | null;
  codigo_postal?: string | null;
  municipio?: string | null;
  localidad?: string | null;
  estado?: string | null;
  colonia?: string | null;
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  contacto_1_nombre?: string | null;
  contacto_1_correo?: string | null;
  contacto_1_telefono?: string | null;
  contacto_2_nombre?: string | null;
  contacto_2_correo?: string | null;
  contacto_2_telefono?: string | null;
  contacto_3_nombre?: string | null;
  contacto_3_correo?: string | null;
  contacto_3_telefono?: string | null;
  [key: string]: any;
}

export interface ContactoCliente {
  nombre: string;
  correo: string;
  telefono: string;
}

/** Contactos capturados del cliente (1 a 3), omitiendo los vacíos. */
export function getContactos(cliente: Cliente): ContactoCliente[] {
  return [1, 2, 3]
    .map((n) => ({
      nombre: cliente[`contacto_${n}_nombre`] || '',
      correo: cliente[`contacto_${n}_correo`] || '',
      telefono: cliente[`contacto_${n}_telefono`] || '',
    }))
    .filter((c) => c.nombre || c.correo || c.telefono);
}

/** Llamadas al backend de la vista de clientes. */
@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly api = inject(ApiService);

  async select(): Promise<Cliente[]> {
    return extractList<Cliente>(await this.api.get('/clientes/select'));
  }

  create(formData: FormData) {
    return this.api.post('/clientes/create', formData);
  }

  update(formData: FormData) {
    return this.api.post('/clientes/update', formData);
  }

  delete(id: string | number, deletedBy: string | null) {
    return this.api.post('/clientes/delete', { id, deleted_by: deletedBy });
  }
}

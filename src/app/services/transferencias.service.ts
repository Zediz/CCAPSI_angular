import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Transferencia {
  id: string | number;
  destino?: string;
  descripcion?: string;
  cantidad?: string | number;
  status?: string;
  created_at?: string;
  fecha_transferencia?: string;
  created_by?: string | number;
  updated_by?: string | number;
  [key: string]: any;
}

/** Llamadas al backend de la vista de transferencias. */
@Injectable({ providedIn: 'root' })
export class TransferenciasService {
  private readonly api = inject(ApiService);

  async getAllByDate(start: string, end: string): Promise<Transferencia[]> {
    const data = await this.api.post('/transferencias/get_all_by_date', {
      start_date: start,
      end_date: end,
    });
    return data.body || [];
  }

  create(formData: FormData) {
    return this.api.post('/transferencias/create', formData);
  }

  update(formData: FormData) {
    return this.api.post('/transferencias/update', formData);
  }

  setTransferido(id: string | number) {
    return this.api.post('/transferencias/set_transferido', { id });
  }

  delete(id: string | number, updatedBy: string | null) {
    return this.api.post('/transferencias/delete', { id, updated_by: updatedBy });
  }
}

import { Injectable } from '@angular/core';
import Swal, { SweetAlertOptions, SweetAlertResult } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertService {
  showError(error: unknown, title = 'Error'): void {
    const message = error instanceof Error ? error.message : '';
    Swal.fire({
      icon: 'error',
      title,
      text: message ? message.replace(/"/g, '') : 'Ocurrió un error al guardar la factura.',
      confirmButtonColor: '#1a6cff',
    });
  }

  showSuccess(title: string, description = ''): void {
    Swal.fire({ icon: 'success', title, text: description, confirmButtonColor: '#1a6cff' });
  }

  fire(options: SweetAlertOptions): Promise<SweetAlertResult> {
    return Swal.fire(options);
  }

  /** Confirmación de eliminación con el estilo usado en el portal. */
  confirmDelete(title: string): Promise<boolean> {
    return Swal.fire({
      icon: 'warning',
      title,
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonColor: '#ff4757',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((r) => r.isConfirmed);
  }
}

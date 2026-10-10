import { Injectable, inject } from '@angular/core';
import { ApiService, extractList } from './api.service';
import { CourseOption } from '../models/course';

export interface Cotizacion {
  id: string | number;
  created_at?: string;
  nombre?: string;
  empresa?: string;
  email?: string;
  whatsapp?: string;
  mensaje?: string;
  status?: string;
  course_uuid?: string;
  course_name?: string;
  course_title?: string;
  [key: string]: any;
}

/** Llamadas al backend de la vista de cotizaciones. */
@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  private readonly api = inject(ApiService);

  async getCotizaciones(start: string, end: string): Promise<Cotizacion[]> {
    const data = await this.api.get(`/cotizaciones/${start}/${end}/get_cotizaciones`);
    return data.body || [];
  }

  async getCourseOptions(): Promise<CourseOption[]> {
    return extractList<CourseOption>(await this.api.get('/courses/select_options'));
  }

  create(formData: FormData) {
    return this.api.post('/cotizaciones/create', formData);
  }

  update(formData: FormData) {
    return this.api.post('/cotizaciones/update', formData);
  }

  delete(id: string | number) {
    const formData = new FormData();
    formData.append('id', String(id));
    return this.api.post('/cotizaciones/delete', formData);
  }

  /**
   * Envía la cotización por correo y la guarda como "enviado". Sin `cotizacion_id` el backend
   * crea la cotización con los datos del formulario (curso, nombre, empresa, whatsapp...).
   */
  /** Archivo adjunto guardado de la cotización (el que se envió por última vez). */
  downloadArchivo(id: string | number): Promise<Blob> {
    return this.api.getBlob(`/cotizaciones/${id}/download_archivo`);
  }

  sendCotizacion(formData: FormData) {
    return this.api.post('/cotizaciones/send_cotizacion', formData);
  }
}

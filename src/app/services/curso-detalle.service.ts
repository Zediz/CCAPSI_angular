import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Course } from '../models/course';

/** Llamadas al backend de la vista de detalle de un curso. */
@Injectable({ providedIn: 'root' })
export class CursoDetalleService {
  private readonly api = inject(ApiService);

  async getCourse(uuid: string): Promise<Course> {
    const data = await this.api.get(`/courses/${uuid}/select_by_id`);
    return (data.body ? data.body : data) as Course;
  }

  createCotizacion(formData: FormData) {
    return this.api.post('/cotizaciones/create', formData);
  }

  createInteresado(formData: FormData) {
    return this.api.post('/interesados/create', formData);
  }
}

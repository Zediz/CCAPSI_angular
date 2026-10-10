import { Injectable, inject } from '@angular/core';
import { ApiService, extractList } from './api.service';
import { CourseOption } from '../models/course';

/** Curso agendado en el calendario. Sin `curso` es un bloque de tiempo bloqueado. */
export interface CursoAgendado {
  id: string | number;
  curso?: string | null;
  descripcion?: string | null;
  cliente?: string | null;
  modalidad?: 'online' | 'presencial' | null;
  ubicacion?: string | null;
  duracion?: string | null;
  /** `Y-m-d H:i:s` en hora de México. */
  start_date: string;
  end_date: string;
  all_day: string | number | boolean;
  [key: string]: any;
}

/** Llamadas al backend de la vista de calendario. */
@Injectable({ providedIn: 'root' })
export class CursosAgendadosService {
  private readonly api = inject(ApiService);

  /** Registros que se cruzan con el rango (fechas `Y-m-d` inclusivas). */
  async getAllByDate(start: string, end: string): Promise<CursoAgendado[]> {
    const data = await this.api.post('/cursos_agendados/get_all_by_date', {
      start_date: start,
      end_date: end,
    });
    return data.body || [];
  }

  async getCourseOptions(): Promise<CourseOption[]> {
    return extractList<CourseOption>(await this.api.get('/courses/select_options'));
  }

  create(data: Record<string, string>) {
    return this.api.post('/cursos_agendados/create', data);
  }

  update(data: Record<string, string>) {
    return this.api.post('/cursos_agendados/update', data);
  }

  delete(id: string | number, deletedBy: string | null) {
    return this.api.post('/cursos_agendados/delete', { id, deleted_by: deletedBy });
  }
}

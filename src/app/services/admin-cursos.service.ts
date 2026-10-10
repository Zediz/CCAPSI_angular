import { Injectable, inject } from '@angular/core';
import { ApiService, extractList } from './api.service';
import { Course } from '../models/course';

/** Llamadas al backend de la vista administrativa de cursos. */
@Injectable({ providedIn: 'root' })
export class AdminCursosService {
  private readonly api = inject(ApiService);

  async getAll(): Promise<Course[]> {
    return extractList<Course>(await this.api.get('/courses/get_all'));
  }

  create(payload: Record<string, string | number>) {
    return this.api.post('/courses/create', ApiService.toFormData(payload));
  }

  update(payload: Record<string, string | number>) {
    return this.api.post('/courses/update', ApiService.toFormData(payload));
  }
}

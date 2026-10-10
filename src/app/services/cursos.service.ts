import { Injectable, inject } from '@angular/core';
import { ApiService, extractList } from './api.service';
import { Course } from '../models/course';

/** Llamadas al backend del catálogo público de cursos. */
@Injectable({ providedIn: 'root' })
export class CursosService {
  private readonly api = inject(ApiService);

  async getAll(): Promise<Course[]> {
    return extractList<Course>(await this.api.get('/courses/get_all'));
  }
}

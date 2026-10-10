import { Injectable, inject } from '@angular/core';
import { ApiService, extractList } from './api.service';
import { Course, CourseOption } from '../models/course';

/** Llamadas al backend de la landing page. */
@Injectable({ providedIn: 'root' })
export class LandingService {
  private readonly api = inject(ApiService);

  async getIndexCourses(): Promise<Course[]> {
    return extractList<Course>(await this.api.get('/courses/get_index_courses'));
  }

  async getCourseOptions(): Promise<CourseOption[]> {
    return extractList<CourseOption>(await this.api.get('/courses/select_options'));
  }

  createCotizacion(formData: FormData) {
    return this.api.post('/cotizaciones/create', formData);
  }
}

import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Course } from '../../models/course';

@Component({
  selector: 'app-course-card',
  imports: [RouterLink],
  templateUrl: './course-card.html',
  host: { style: 'display: contents' },
})
export class CourseCard {
  readonly curso = input.required<Course>();
  readonly index = input(0);

  protected readonly isCertified = computed(
    () => !!this.curso().certification_type?.includes('DC-3'),
  );

  protected readonly price = computed(() => {
    const priceNumber = parseFloat(String(this.curso().price)) || 0;
    if (priceNumber <= 0) return '';
    return priceNumber
      .toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      .replace('.00', '');
  });

  protected onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = 'assets/images/hero_instructor.png';
    if (!img.src.endsWith(fallback)) img.src = fallback;
  }
}

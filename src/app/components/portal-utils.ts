import { signal } from '@angular/core';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es';
import { Instance } from 'flatpickr/dist/types/instance';

/**
 * Crea el selector de rango de fechas (flatpickr) usado en el portal.
 * `monthsBack` define el rango por defecto hasta hoy; `'currentMonth'` usa del día 1
 * al último día del mes actual.
 */
export function createDateRangePicker(
  input: HTMLInputElement,
  monthsBack: number | 'currentMonth',
  onRangeSelected: () => void,
): Instance {
  const today = new Date();
  let start: Date;
  let end: Date;
  if (monthsBack === 'currentMonth') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else {
    start = new Date();
    start.setMonth(today.getMonth() - monthsBack);
    end = today;
  }

  return flatpickr(input, {
    mode: 'range',
    locale: Spanish,
    dateFormat: 'Y-m-d',
    defaultDate: [start, end],
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) onRangeSelected();
    },
  });
}

/** Devuelve el rango seleccionado como `Y-m-d`, o null si no hay rango completo. */
export function getSelectedRange(picker?: Instance): { start: string; end: string } | null {
  if (!picker || picker.selectedDates.length !== 2) return null;
  return {
    start: flatpickr.formatDate(picker.selectedDates[0], 'Y-m-d'),
    end: flatpickr.formatDate(picker.selectedDates[1], 'Y-m-d'),
  };
}

/** Formatea una fecha como `Y-m-d`. */
export function formatYmd(date: Date): string {
  return flatpickr.formatDate(date, 'Y-m-d');
}

export type SortDirection = 'asc' | 'desc';

/** Ordenamiento genérico usado por las tablas del portal. */
export function sortRows<T extends Record<string, any>>(
  rows: T[],
  column: string,
  direction: SortDirection,
  numericColumns: string[] = [],
  dateColumns: string[] = [],
): T[] {
  return [...rows].sort((a, b) => {
    let valA = a[column] ?? '';
    let valB = b[column] ?? '';

    if (numericColumns.includes(column)) {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else if (dateColumns.includes(column)) {
      valA = new Date(valA).getTime() || 0;
      valB = new Date(valB).getTime() || 0;
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/** Estado de un modal con animación de entrada/salida (fade + slide). */
export class AnimatedModal {
  readonly visible = signal(false);
  readonly shown = signal(false);

  open(): void {
    this.visible.set(true);
    requestAnimationFrame(() => this.shown.set(true));
  }

  close(afterClose?: () => void): void {
    this.shown.set(false);
    setTimeout(() => {
      this.visible.set(false);
      afterClose?.();
    }, 300);
  }
}

/** Descarga un Blob como archivo. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

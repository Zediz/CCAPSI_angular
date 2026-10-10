import { Component, computed, signal } from '@angular/core';

/** Resultados aproximados con 3 decimales. */
const MONEY = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const IVA = 0.16;
/** Retenciones de persona moral: ISR 1.25% e IVA retenido = 2/3 del IVA (tasa CFDI 0.106667). */
const ISR_RETENIDO = 0.0125;
const IVA_RETENIDO = 0.106667;

type Persona = 'fisica' | 'moral';

interface CalcRow {
  label: string;
  value: string;
  /** Se resta del total (retenciones). */
  resta?: boolean;
}

function toNumber(value: unknown): number {
  return parseFloat(String(value ?? '')) || 0;
}

/**
 * Widget de cálculo de IVA. Física: subtotal + IVA (opcionalmente desde un monto con IVA).
 * Moral: desglose con retenciones a partir del subtotal, o del monto depositado si ya las incluye.
 */
@Component({
  selector: 'app-calculadora-iva',
  templateUrl: './calculadora-iva.html',
  styleUrl: './calculadora-iva.scss',
})
export class CalculadoraIva {
  protected readonly ivaPersona = signal<Persona>('moral');
  /** Moral: el monto es lo depositado (ya con IVA y retenciones) en lugar del subtotal. */
  protected readonly retencionesIncluidas = signal(false);
  protected readonly ivaMonto = signal(0);
  protected readonly ivaIncluido = signal(false);

  protected readonly ivaMontoLabel = computed(() => {
    if (this.ivaPersona() === 'fisica') return 'Monto';
    return this.retencionesIncluidas() ? 'Monto depositado' : 'Subtotal de la factura';
  });

  protected readonly ivaResultado = computed<{ rows: CalcRow[]; total: string }>(() => {
    const monto = this.ivaMonto();

    if (this.ivaPersona() === 'fisica') {
      const subtotal = this.ivaIncluido() ? monto / (1 + IVA) : monto;
      const iva = subtotal * IVA;
      return {
        rows: [
          { label: 'Subtotal', value: MONEY.format(subtotal) },
          { label: 'IVA 16%', value: MONEY.format(iva) },
        ],
        total: MONEY.format(subtotal + iva),
      };
    }

    // Persona moral: sin la casilla el monto es el subtotal; con ella es el total ya con IVA y retenciones
    const subtotal =
      this.retencionesIncluidas() ? monto / (1 + IVA - ISR_RETENIDO - IVA_RETENIDO) : monto;
    const iva = subtotal * IVA;
    const isrRetenido = subtotal * ISR_RETENIDO;
    const ivaRetenido = subtotal * IVA_RETENIDO;
    return {
      rows: [
        { label: 'Subtotal', value: MONEY.format(subtotal) },
        { label: 'IVA 16%', value: MONEY.format(iva) },
        { label: 'ISR R 1.25%', value: MONEY.format(isrRetenido), resta: true },
        { label: 'IVA R 10.667%', value: MONEY.format(ivaRetenido), resta: true },
      ],
      total: MONEY.format(subtotal + iva - isrRetenido - ivaRetenido),
    };
  });

  protected onIvaMonto(event: Event): void {
    this.ivaMonto.set(Math.max(0, toNumber((event.target as HTMLInputElement).value)));
  }

  protected setIvaPersona(persona: Persona): void {
    this.ivaPersona.set(persona);
  }

  protected onRetencionesIncluidas(event: Event): void {
    this.retencionesIncluidas.set((event.target as HTMLInputElement).checked);
  }

  protected onIvaIncluido(event: Event): void {
    this.ivaIncluido.set((event.target as HTMLInputElement).checked);
  }
}

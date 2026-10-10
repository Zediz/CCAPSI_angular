import { Component, computed, inject, output, signal } from '@angular/core';
import { BalanceService } from '../../services/balance.service';
import { formatYmd } from '../portal-utils';

const MONEY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export interface MonthRange {
  start_date: string;
  end_date: string;
}

/**
 * Card con el balance de la cuenta. Las flechas navegan entre meses y emiten
 * `monthChange` con el primer y último día del mes seleccionado (`Y-m-d`).
 */
@Component({
  selector: 'app-balance',
  templateUrl: './balance.html',
  styleUrl: './balance.scss',
})
export class Balance {
  private readonly service = inject(BalanceService);

  readonly monthChange = output<MonthRange>();

  /** Primer día del mes seleccionado. */
  protected readonly month = signal(firstDayOfMonth(new Date()));
  protected readonly balance = signal<number | null>(null);
  protected readonly previousBalance = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly isCurrentMonth = computed(
    () => monthKey(this.month()) === monthKey(firstDayOfMonth(new Date())),
  );
  protected readonly monthLabel = computed(() => monthLabel(this.month()));
  protected readonly previousMonthLabel = computed(() => monthLabel(addMonths(this.month(), -1)));

  /** Evita que una respuesta lenta de un mes anterior pise la del mes seleccionado. */
  private requestId = 0;

  constructor() {
    this.loadBalance();
  }

  protected previousMonth(): void {
    this.changeMonth(-1);
  }

  protected nextMonth(): void {
    if (!this.isCurrentMonth()) this.changeMonth(1);
  }

  protected format(value: number | null): string {
    return value === null ? '—' : MONEY.format(value);
  }

  private changeMonth(delta: number): void {
    const month = addMonths(this.month(), delta);
    this.month.set(month);
    this.monthChange.emit({
      start_date: formatYmd(month),
      end_date: formatYmd(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
    });
    this.loadBalance();
  }

  private async loadBalance(): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    try {
      const res = await this.service.getMonthBalance(monthKey(this.month()));
      if (id !== this.requestId) return;
      this.balance.set(toNumber(res?.balance));
      this.previousBalance.set(toNumber(res?.previous_balance));
    } catch (error) {
      if (id !== this.requestId) return;
      console.error('Error al cargar el balance:', error);
      this.balance.set(null);
      this.previousBalance.set(null);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  const label = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

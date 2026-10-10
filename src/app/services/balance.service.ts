import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface MonthBalance {
  month: string;
  is_current_month: boolean;
  /** closing_balance del último snapshot del mes anterior. */
  previous_balance: number | null;
  /** Mes actual: running_balance de la transacción más reciente; otro mes: último snapshot del mes. */
  balance: number | null;
}

/** Llamadas al backend para el balance de la cuenta. */
@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly api = inject(ApiService);

  /** `month` en formato `Y-m`. */
  async getMonthBalance(month: string): Promise<MonthBalance> {
    const data = await this.api.get(`/balances_snapshots/${month}/get_month_balance`);
    return data.body;
  }
}

import { Injectable, inject } from '@angular/core';
import { ApiService, extractList } from './api.service';

export interface Email {
  id: string | number;
  message_id?: string;
  from_name?: string | null;
  from_email?: string;
  to_name?: string | null;
  to_email?: string;
  subject?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  has_attachments?: string | number;
  has_inline_images?: string | number;
  is_replied?: string | number;
  replied_at?: string | null;
  received_at?: string;
  [key: string]: any;
}

/** Llamadas al backend de la vista de correos. */
@Injectable({ providedIn: 'root' })
export class EmailsService {
  private readonly api = inject(ApiService);

  /** Listado por rango de `received_at`; no incluye el cuerpo del correo. */
  async getEmails(start: string, end: string): Promise<Email[]> {
    return extractList<Email>(await this.api.get(`/emails/${start}/${end}/get_emails`));
  }

  /** Correo completo, con `body_html` y `body_text`. */
  async selectById(id: string | number): Promise<Email> {
    const data = await this.api.get(`/emails/${id}/select_by_id`);
    return data.body;
  }

  /** Invierte `is_replied`; devuelve el nuevo estado y su `replied_at`. */
  async toggleResponded(id: string | number): Promise<Pick<Email, 'is_replied' | 'replied_at'>> {
    const data = await this.api.post('/emails/toggle_responded', { id });
    return data.body;
  }
}

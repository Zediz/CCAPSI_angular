import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Factura {
  id?: string | number;
  uuid_fiscal?: string;
  serie?: string;
  folio?: string;
  fecha_emision?: string;
  receptor_nombre?: string;
  receptor_rfc?: string;
  subtotal?: string | number;
  total?: string | number;
  moneda?: string;
  pagada?: string | number;
  enviada?: string | number;
  [key: string]: any;
}

function descripcionTransaccion(folio: string): string {
  return `Pago de factura ${folio}`.slice(0, 255);
}

/** Llamadas al backend de la vista de facturas. */
@Injectable({ providedIn: 'root' })
export class FacturasService {
  private readonly api = inject(ApiService);

  async getFacturas(start: string, end: string): Promise<Factura[]> {
    const data = await this.api.get(`/facturas/${start}/${end}/get_facturas`);
    return data.body || [];
  }

  create(xmlFile: File, pdfFile: File) {
    const formData = new FormData();
    formData.append('xml_file', xmlFile);
    formData.append('pdf_file', pdfFile);
    return this.api.post('/facturas/create', formData);
  }

  sendFactura(uuid: string, nombre: string, email: string, mensaje: string) {
    const formData = new FormData();
    formData.append('uuid_fiscal', uuid);
    formData.append('nombre_cliente', nombre);
    formData.append('email', email);
    formData.append('mensaje', mensaje);
    return this.api.post('/facturas/send_factura', formData);
  }

  setPagada(uuid: string, pagada: 0 | 1) {
    return this.api.get(`/facturas/${pagada}/${uuid}/set_pagada`);
  }

  /** Crea la transacción de CCAPSI del pago (el backend calcula el running_balance). */
  crearTransaccion(folio: string, utilidadNeta: number) {
    return this.api.post('/transacciones_ccapsi/create', {
      description: descripcionTransaccion(folio),
      amount: utilidadNeta.toFixed(2),
    });
  }

  /**
   * Borra la transacción de CCAPSI del pago buscándola por description (lleva el folio) + amount;
   * el backend recalcula las siguientes y los snapshots. Si no existe no es error.
   */
  borrarTransaccion(folio: string, utilidadNeta: number) {
    return this.api.post('/transacciones_ccapsi/delete_by_match', {
      description: descripcionTransaccion(folio),
      amount: utilidadNeta.toFixed(2),
    });
  }

  delete(uuid: string) {
    const formData = new FormData();
    formData.append('uuid', uuid);
    return this.api.post('/facturas/delete', formData);
  }

  downloadXml(uuid: string): Promise<Blob> {
    return this.api.getBlob(`/facturas/${uuid}/download_xml`);
  }

  downloadPdf(uuid: string): Promise<Blob> {
    return this.api.getBlob(`/facturas/${uuid}/download_pdf`);
  }
}

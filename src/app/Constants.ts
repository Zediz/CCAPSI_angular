export interface RegimenFiscal {
  clave: string;
  descripcion: string;
}

/** Catálogo SAT de régimen fiscal (c_RegimenFiscal). */
export const REGIMENES_FISCALES: RegimenFiscal[] = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', descripcion: 'Arrendamiento' },
  { clave: '608', descripcion: 'Demás ingresos' },
  { clave: '609', descripcion: 'Consolidación' },
  { clave: '610', descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { clave: '611', descripcion: 'Ingresos por Dividendos (socios y accionistas)' },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', descripcion: 'Ingresos por intereses' },
  { clave: '616', descripcion: 'Sin obligaciones fiscales' },
  { clave: '620', descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { clave: '621', descripcion: 'Incorporación Fiscal' },
  { clave: '622', descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave: '623', descripcion: 'Opcional para Grupos de Sociedades' },
  { clave: '624', descripcion: 'Coordinados' },
  { clave: '628', descripcion: 'Hidrocarburos' },
  { clave: '607', descripcion: 'Régimen de Enajenación o Adquisición de Bienes' },
  { clave: '629', descripcion: 'De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales' },
  { clave: '630', descripcion: 'Enajenación de acciones en bolsa de valores' },
  { clave: '615', descripcion: 'Régimen de los ingresos por obtención de premios' },
  { clave: '625', descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnologicas' },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza' },
];

const REGIMENES_POR_CLAVE = new Map(REGIMENES_FISCALES.map((r) => [r.clave, r.descripcion]));

/** Descripción del régimen fiscal a partir de su clave SAT (ej. '601'). */
export function getRegimenFiscal(clave?: string | null): string {
  return (clave && REGIMENES_POR_CLAVE.get(clave)) || '';
}

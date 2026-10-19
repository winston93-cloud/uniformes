export const BUCKET_CONSTANCIAS_FISCALES = 'datos-fiscales-clientes';

const NOMBRE_ARCHIVO = 'constancia-situacion-fiscal.pdf';

/** Tamaño máximo 5 MB (alineado con bucket). */
export const MAX_BYTES_CONSTANCIA_PDF = 5 * 1024 * 1024;

export function rutaConstanciaPdfEnBucket(registroDatosFiscalesId: string): string {
  return `${registroDatosFiscalesId}/${NOMBRE_ARCHIVO}`;
}

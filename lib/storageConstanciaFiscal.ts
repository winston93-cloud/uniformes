import { insforgeBrowser } from '@/lib/insforgeBrowser';

export const BUCKET_CONSTANCIAS_FISCALES = 'datos-fiscales-clientes';

const NOMBRE_ARCHIVO = 'constancia-situacion-fiscal.pdf';

/** Tamaño máximo 5 MB (alineado con bucket). */
export const MAX_BYTES_CONSTANCIA_PDF = 5 * 1024 * 1024;

export function rutaConstanciaPdfEnBucket(registroDatosFiscalesId: string): string {
  return `${registroDatosFiscalesId}/${NOMBRE_ARCHIVO}`;
}

function bucket() {
  return insforgeBrowser.storage.from(BUCKET_CONSTANCIAS_FISCALES);
}

export async function subirConstanciaPdf(registroId: string, file: File): Promise<{ error: string | null }> {
  if (file.type !== 'application/pdf') {
    return { error: 'El archivo debe ser PDF.' };
  }
  if (file.size > MAX_BYTES_CONSTANCIA_PDF) {
    return { error: 'El PDF no puede superar 5 MB.' };
  }
  const path = rutaConstanciaPdfEnBucket(registroId);
  const { error } = await bucket().upload(path, file);
  if (error) return { error: error.message };
  return { error: null };
}

export async function eliminarConstanciaPdfEnStorage(pathRelativo: string): Promise<{ error: string | null }> {
  const { error } = await bucket().remove(pathRelativo);
  if (error) return { error: error.message };
  return { error: null };
}

/** Descarga vía SDK InsForge; devuelve object URL para abrir/descargar en el navegador. */
export async function urlDescargaConstanciaPdf(
  pathRelativo: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await bucket().download(pathRelativo);
  if (error) return { url: null, error: error.message };
  if (!data) return { url: null, error: 'No se pudo descargar el PDF.' };
  return { url: URL.createObjectURL(data), error: null };
}

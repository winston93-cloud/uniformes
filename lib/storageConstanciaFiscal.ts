import { supabase } from '@/lib/supabase';

export const BUCKET_CONSTANCIAS_FISCALES = 'datos-fiscales-clientes';

const NOMBRE_ARCHIVO = 'constancia-situacion-fiscal.pdf';

/** Tamaño máximo 5 MB (alineado con bucket). */
export const MAX_BYTES_CONSTANCIA_PDF = 5 * 1024 * 1024;

export function rutaConstanciaPdfEnBucket(registroDatosFiscalesId: string): string {
  return `${registroDatosFiscalesId}/${NOMBRE_ARCHIVO}`;
}

export async function subirConstanciaPdf(registroId: string, file: File): Promise<{ error: string | null }> {
  if (file.type !== 'application/pdf') {
    return { error: 'El archivo debe ser PDF.' };
  }
  if (file.size > MAX_BYTES_CONSTANCIA_PDF) {
    return { error: 'El PDF no puede superar 5 MB.' };
  }
  const path = rutaConstanciaPdfEnBucket(registroId);
  const { error } = await supabase.storage.from(BUCKET_CONSTANCIAS_FISCALES).upload(path, file, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function eliminarConstanciaPdfEnStorage(pathRelativo: string): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(BUCKET_CONSTANCIAS_FISCALES).remove([pathRelativo]);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * URL firmada solo lectura: no modifica Storage ni la tabla `datos_fiscales_cliente`.
 * Puedes llamarla las veces que haga falta para descargar el mismo archivo.
 */
export async function urlDescargaConstanciaPdf(
  pathRelativo: string,
  segundosValidez = 3600
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(BUCKET_CONSTANCIAS_FISCALES)
    .createSignedUrl(pathRelativo, segundosValidez);
  if (error) return { url: null, error: error.message };
  return { url: data?.signedUrl ?? null, error: null };
}

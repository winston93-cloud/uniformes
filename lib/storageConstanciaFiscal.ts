import { MAX_BYTES_CONSTANCIA_PDF, rutaConstanciaPdfEnBucket } from '@/lib/storageConstanciaFiscalRutas';

export { BUCKET_CONSTANCIAS_FISCALES, MAX_BYTES_CONSTANCIA_PDF, rutaConstanciaPdfEnBucket } from '@/lib/storageConstanciaFiscalRutas';

async function errorDe(res: Response, porDefecto: string): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    return json.error || porDefecto;
  } catch {
    return porDefecto;
  }
}

export async function subirConstanciaPdf(registroId: string, file: File): Promise<{ error: string | null }> {
  if (file.type !== 'application/pdf') {
    return { error: 'El archivo debe ser PDF.' };
  }
  if (file.size > MAX_BYTES_CONSTANCIA_PDF) {
    return { error: 'El PDF no puede superar 5 MB.' };
  }
  const form = new FormData();
  form.append('registroId', registroId);
  form.append('file', file);
  const res = await fetch('/api/constancia-fiscal', { method: 'POST', body: form });
  if (!res.ok) return { error: await errorDe(res, 'No se pudo subir el PDF.') };
  return { error: null };
}

export async function eliminarConstanciaPdfEnStorage(pathRelativo: string): Promise<{ error: string | null }> {
  const res = await fetch(`/api/constancia-fiscal?path=${encodeURIComponent(pathRelativo)}`, { method: 'DELETE' });
  if (!res.ok) return { error: await errorDe(res, 'No se pudo eliminar el PDF.') };
  return { error: null };
}

/** Descarga por el servidor; devuelve object URL para abrir/descargar en el navegador. */
export async function urlDescargaConstanciaPdf(
  pathRelativo: string
): Promise<{ url: string | null; error: string | null }> {
  const res = await fetch(`/api/constancia-fiscal?path=${encodeURIComponent(pathRelativo)}`, { cache: 'no-store' });
  if (!res.ok) return { url: null, error: await errorDe(res, 'No se pudo descargar el PDF.') };
  return { url: URL.createObjectURL(await res.blob()), error: null };
}

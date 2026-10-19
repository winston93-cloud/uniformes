import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';
import {
  BUCKET_CONSTANCIAS_FISCALES,
  MAX_BYTES_CONSTANCIA_PDF,
  rutaConstanciaPdfEnBucket,
} from '@/lib/storageConstanciaFiscalRutas';

/** El bucket es privado: el navegador no tiene llave de servicio, todo pasa por aquí. */
const RUTA_VALIDA = /^[0-9a-f-]{36}\/constancia-situacion-fiscal\.pdf$/i;
const REGISTRO_VALIDO = /^[0-9a-f-]{36}$/i;

function bucket() {
  return getInsforge().storage.from(BUCKET_CONSTANCIAS_FISCALES);
}

function rutaDe(req: Request): string | null {
  const path = new URL(req.url).searchParams.get('path') ?? '';
  return RUTA_VALIDA.test(path) ? path : null;
}

function errorJson(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: Request) {
  const path = rutaDe(req);
  if (!path) return errorJson('Ruta de constancia inválida.', 400);
  const { data, error } = await bucket().download(path);
  if (error || !data) return errorJson(error?.message || 'No se pudo descargar el PDF.', 404);
  return new NextResponse(data, {
    headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const registroId = String(form.get('registroId') ?? '');
  const file = form.get('file');
  if (!REGISTRO_VALIDO.test(registroId)) return errorJson('Registro inválido.', 400);
  if (!(file instanceof File)) return errorJson('Falta el archivo.', 400);
  if (file.type !== 'application/pdf') return errorJson('El archivo debe ser PDF.', 400);
  if (file.size > MAX_BYTES_CONSTANCIA_PDF) return errorJson('El PDF no puede superar 5 MB.', 400);
  const { error } = await bucket().upload(rutaConstanciaPdfEnBucket(registroId), file);
  if (error) return errorJson(error.message, 500);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const path = rutaDe(req);
  if (!path) return errorJson('Ruta de constancia inválida.', 400);
  const { error } = await bucket().remove(path);
  if (error) return errorJson(error.message, 500);
  return NextResponse.json({ success: true });
}

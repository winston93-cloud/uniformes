import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';
import { COOKIE_NAME, verificarTokenSesion } from '@/lib/auth-cookie';

const TIPOS = new Set(['error', 'silencioso', 'aviso']);

/** Registra un error o aviso de pantalla (solo con sesión iniciada). Nunca falla hacia el navegador. */
export async function POST(request: Request) {
  try {
    const cookie = request.headers.get('cookie') ?? '';
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    const sesion = await verificarTokenSesion(match?.[1]);
    if (!sesion) return new NextResponse(null, { status: 204 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const tipo = String(body?.tipo ?? '');
    const mensaje = String(body?.mensaje ?? '').trim();
    if (!TIPOS.has(tipo) || !mensaje) return new NextResponse(null, { status: 204 });

    await getInsforge().database.rpc('registrar_evento_uniformes', {
      p_tipo: tipo,
      p_pantalla: String(body?.pantalla ?? '').slice(0, 120),
      p_mensaje: mensaje.slice(0, 500),
      p_detalle: body?.detalle ? String(body.detalle).slice(0, 2000) : null,
      p_usuario: sesion.usuario,
    });
  } catch {}
  return new NextResponse(null, { status: 204 });
}

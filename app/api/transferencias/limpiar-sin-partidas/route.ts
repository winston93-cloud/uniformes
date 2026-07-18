import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';

/** Cancela transferencias EN_TRANSITO sin partidas (huérfanas). */
export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { transferencia_id?: string };
    const db = getInsforge().database;
    const soloId = String(body.transferencia_id ?? '').trim();

    let query = db
      .from('transferencias')
      .select('id, folio, estado, sucursal_origen_id, sucursal_destino_id')
      .in('estado', ['EN_TRANSITO', 'PENDIENTE']);

    if (soloId) query = query.eq('id', soloId);

    const { data: cabeceras, error } = await query;
    if (error) throw error;

    const canceladas: string[] = [];
    for (const t of cabeceras || []) {
      const tid = String(t.id);
      const origenOk = String(t.sucursal_origen_id) === sesion.sucursal_id;
      const destOk = String(t.sucursal_destino_id) === sesion.sucursal_id;
      if (!origenOk && !destOk) continue;

      const { data: dets, error: errD } = await db
        .from('detalle_transferencias')
        .select('id')
        .eq('transferencia_id', tid)
        .limit(1);
      if (errD) throw errD;
      if ((dets || []).length > 0) continue;

      const { error: errUp } = await db
        .from('transferencias')
        .update({ estado: 'CANCELADA' })
        .eq('id', tid);
      if (errUp) throw errUp;
      canceladas.push(String(t.folio || tid));
    }

    return NextResponse.json({
      ok: true,
      canceladas,
      message:
        canceladas.length > 0
          ? `Se cancelaron ${canceladas.length} transferencia(s) sin partidas.`
          : 'No había transferencias vacías para cancelar.',
    });
  } catch (e) {
    console.error('POST /api/transferencias/limpiar-sin-partidas', e);
    const message = e instanceof Error ? e.message : 'Error al limpiar.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

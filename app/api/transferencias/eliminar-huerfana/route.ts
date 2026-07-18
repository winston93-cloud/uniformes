import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';

/** Cancela/elimina una transferencia sin partidas o aún EN_TRANSITO (solo origen). */
export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { transferencia_id?: string };
    const transferenciaId = String(body.transferencia_id ?? '').trim();
    if (!transferenciaId) {
      return NextResponse.json({ ok: false, message: 'Falta transferencia_id.' }, { status: 400 });
    }

    const db = getInsforge().database;
    const { data: transferencia, error: errT } = await db
      .from('transferencias')
      .select('*')
      .eq('id', transferenciaId)
      .single();
    if (errT || !transferencia) {
      return NextResponse.json({ ok: false, message: 'Transferencia no encontrada.' }, { status: 404 });
    }

    if (String(transferencia.sucursal_origen_id) !== sesion.sucursal_id) {
      return NextResponse.json({ ok: false, message: 'Solo el origen puede eliminar esta transferencia.' }, { status: 403 });
    }

    if (transferencia.estado === 'RECIBIDA' || transferencia.estado === 'RECIBIDA_PARCIAL') {
      return NextResponse.json({ ok: false, message: 'No se puede eliminar una transferencia ya recibida.' }, { status: 400 });
    }

    const { data: detalles } = await db
      .from('detalle_transferencias')
      .select('id')
      .eq('transferencia_id', transferenciaId);

    if ((detalles || []).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Esta transferencia sí tiene partidas. Usa modificar/recibir, no eliminar.',
        },
        { status: 400 }
      );
    }

    const { error: errDel } = await db.from('transferencias').delete().eq('id', transferenciaId);
    if (errDel) throw new Error(errDel.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/transferencias/eliminar-huerfana', e);
    const message = e instanceof Error ? e.message : 'Error al eliminar.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { reponerStockOrigenTransferencia } from '@/lib/transferenciasStock';

/**
 * Cancela una transferencia en tránsito (o parcial con partidas aún en tránsito)
 * y regresa al origen el stock de las partidas no recibidas.
 */
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

    const estado = String(transferencia.estado ?? '').toUpperCase();
    if (estado === 'CANCELADA') {
      return NextResponse.json({ ok: false, message: 'Esta transferencia ya está cancelada.' }, { status: 400 });
    }
    if (estado === 'RECIBIDA') {
      return NextResponse.json(
        { ok: false, message: 'No se puede cancelar una transferencia ya recibida.' },
        { status: 400 }
      );
    }
    if (estado !== 'EN_TRANSITO' && estado !== 'PENDIENTE' && estado !== 'RECIBIDA_PARCIAL') {
      return NextResponse.json(
        { ok: false, message: `No se puede cancelar en estado ${transferencia.estado}.` },
        { status: 400 }
      );
    }

    const sucursalOrigenId = String(transferencia.sucursal_origen_id ?? '');
    if (!sucursalOrigenId || sucursalOrigenId !== sesion.sucursal_id) {
      return NextResponse.json(
        { ok: false, message: 'Solo la sucursal origen puede cancelar esta transferencia.' },
        { status: 403 }
      );
    }

    const { data: detalles, error: errD } = await db
      .from('detalle_transferencias')
      .select('*')
      .eq('transferencia_id', transferenciaId);
    if (errD) throw errD;

    let unidadesRepuestas = 0;
    for (const d of detalles || []) {
      const est = String(d.estado ?? 'EN_TRANSITO').toUpperCase();
      if (est === 'RECIBIDA') continue;
      const costoId = d.costo_id ? String(d.costo_id) : '';
      const cantidad = Math.trunc(Number(d.cantidad ?? 0));
      if (!costoId || cantidad <= 0) continue;
      // EN_TRANSITO_COMPLEMENTARIO: el stock ya volvió al origen al marcar parcial
      if (est === 'EN_TRANSITO_COMPLEMENTARIO') continue;
      await reponerStockOrigenTransferencia(db, costoId, cantidad, sucursalOrigenId);
      unidadesRepuestas += cantidad;
    }

    const { data: actualizada, error: errUp } = await db
      .from('transferencias')
      .update({ estado: 'CANCELADA' })
      .eq('id', transferenciaId)
      .select('*')
      .single();
    if (errUp) throw errUp;

    return NextResponse.json({
      ok: true,
      transferencia: actualizada,
      unidades_repuestas: unidadesRepuestas,
      message: `Transferencia cancelada. Se regresaron ${unidadesRepuestas} unidad(es) al origen.`,
    });
  } catch (e) {
    console.error('POST /api/transferencias/cancelar', e);
    const message = e instanceof Error ? e.message : 'Error al cancelar transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

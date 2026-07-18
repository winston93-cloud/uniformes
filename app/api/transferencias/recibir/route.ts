import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import {
  abonarStockDestinoTransferencia,
  reponerStockOrigenTransferencia,
} from '@/lib/transferenciasStock';

export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      transferencia_id?: string;
      /** IDs de detalle_transferencias a recibir. Si no viene, se reciben todas. */
      detalle_ids?: string[];
    };
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

    if (String(transferencia.sucursal_destino_id) !== sesion.sucursal_id) {
      return NextResponse.json(
        { ok: false, message: 'Solo la sucursal destino puede confirmar la recepción.' },
        { status: 403 }
      );
    }

    if (transferencia.estado === 'RECIBIDA') {
      return NextResponse.json({ ok: false, message: 'Esta transferencia ya fue recibida.' }, { status: 409 });
    }

    if (transferencia.estado !== 'EN_TRANSITO' && transferencia.estado !== 'PENDIENTE') {
      return NextResponse.json({ ok: false, message: `Estado no válido: ${transferencia.estado}` }, { status: 400 });
    }

    const { data: detalles, error: errD } = await db
      .from('detalle_transferencias')
      .select('*')
      .eq('transferencia_id', transferenciaId);

    if (errD) throw errD;
    if (!detalles?.length) {
      return NextResponse.json({ ok: false, message: 'La transferencia no tiene detalle.' }, { status: 400 });
    }

    const idsSolicitados =
      Array.isArray(body.detalle_ids) && body.detalle_ids.length > 0
        ? new Set(body.detalle_ids.map((id) => String(id).trim()).filter(Boolean))
        : null;

    const aRecibir = idsSolicitados
      ? detalles.filter((d) => idsSolicitados.has(String(d.id)))
      : detalles;
    const aRechazar = idsSolicitados
      ? detalles.filter((d) => !idsSolicitados.has(String(d.id)))
      : [];

    if (aRecibir.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'Selecciona al menos una prenda para recibir.' },
        { status: 400 }
      );
    }

    const sucursalOrigenId = String(transferencia.sucursal_origen_id ?? '');
    const sucursalDestinoId = String(transferencia.sucursal_destino_id);

    for (const det of aRecibir) {
      const cantidad = Math.trunc(Number(det.cantidad ?? 0));
      if (cantidad <= 0) continue;

      const costoId = det.costo_id ? String(det.costo_id) : '';
      if (!costoId) {
        return NextResponse.json({ ok: false, message: 'Detalle sin costo de origen.' }, { status: 400 });
      }

      const { data: costoOrigen, error: errC } = await db.from('costos').select('*').eq('id', costoId).single();
      if (errC || !costoOrigen) {
        return NextResponse.json({ ok: false, message: 'Costo de origen no encontrado.' }, { status: 400 });
      }

      await abonarStockDestinoTransferencia(
        db,
        costoOrigen as Record<string, unknown>,
        sucursalDestinoId,
        cantidad
      );
    }

    // No recibidas: reponer stock en origen y quitar del detalle
    for (const det of aRechazar) {
      const cantidad = Math.trunc(Number(det.cantidad ?? 0));
      const costoId = det.costo_id ? String(det.costo_id) : '';
      if (costoId && cantidad > 0 && sucursalOrigenId) {
        await reponerStockOrigenTransferencia(db, costoId, cantidad, sucursalOrigenId);
      }
      const { error: errDel } = await db.from('detalle_transferencias').delete().eq('id', String(det.id));
      if (errDel) throw new Error(errDel.message);
    }

    const { data: actualizada, error: errUp } = await db
      .from('transferencias')
      .update({ estado: 'RECIBIDA' })
      .eq('id', transferenciaId)
      .eq('estado', transferencia.estado)
      .select('*')
      .single();

    if (errUp || !actualizada) {
      return NextResponse.json({ ok: false, message: 'No se pudo marcar como recibida (¿ya procesada?).' }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      transferencia: actualizada,
      recibidas: aRecibir.length,
      noRecibidas: aRechazar.length,
    });
  } catch (e) {
    console.error('POST /api/transferencias/recibir', e);
    const message = e instanceof Error ? e.message : 'Error al recibir transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

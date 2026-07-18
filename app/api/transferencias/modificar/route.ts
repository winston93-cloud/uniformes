import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import {
  descontarStockOrigenTransferencia,
  reponerStockOrigenTransferencia,
} from '@/lib/transferenciasStock';

type LineaTransferencia = {
  prenda_id: string;
  talla_id: string;
  cantidad: number;
  costo_id: string;
};

export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      transferencia_id?: string;
      observaciones?: string;
      detalles?: LineaTransferencia[];
    };

    const transferenciaId = String(body.transferencia_id ?? '').trim();
    const detalles = Array.isArray(body.detalles) ? body.detalles : [];

    if (!transferenciaId) {
      return NextResponse.json({ ok: false, message: 'Falta transferencia_id.' }, { status: 400 });
    }
    if (detalles.length === 0) {
      return NextResponse.json({ ok: false, message: 'Agrega al menos una prenda con cantidad.' }, { status: 400 });
    }

    for (const d of detalles) {
      const qty = Math.trunc(Number(d.cantidad));
      if (!d.prenda_id || !d.talla_id || !d.costo_id || qty <= 0) {
        return NextResponse.json(
          { ok: false, message: 'Cada línea debe tener prenda, talla, costo y cantidad > 0.' },
          { status: 400 }
        );
      }
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

    if (transferencia.estado !== 'EN_TRANSITO' && transferencia.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { ok: false, message: `Solo se pueden modificar transferencias en tránsito (estado: ${transferencia.estado}).` },
        { status: 400 }
      );
    }

    const sucursalOrigenId = String(transferencia.sucursal_origen_id ?? '');
    if (!sucursalOrigenId || sucursalOrigenId !== sesion.sucursal_id) {
      return NextResponse.json(
        { ok: false, message: 'Solo la sucursal origen puede modificar esta transferencia.' },
        { status: 403 }
      );
    }

    const { data: detallesPrevios, error: errPrev } = await db
      .from('detalle_transferencias')
      .select('*')
      .eq('transferencia_id', transferenciaId);
    if (errPrev) throw errPrev;

    // 1) Reponer stock de las líneas anteriores
    for (const prev of detallesPrevios || []) {
      const costoId = prev.costo_id ? String(prev.costo_id) : '';
      const cantidad = Math.trunc(Number(prev.cantidad ?? 0));
      if (!costoId || cantidad <= 0) continue;
      await reponerStockOrigenTransferencia(db, costoId, cantidad, sucursalOrigenId);
    }

    // 2) Borrar detalle anterior
    const { error: errDel } = await db
      .from('detalle_transferencias')
      .delete()
      .eq('transferencia_id', transferenciaId);
    if (errDel) throw new Error(errDel.message);

    // 3) Descontar nuevas líneas y guardar detalle
    const descontados: LineaTransferencia[] = [];
    try {
      for (const d of detalles) {
        const cantidad = Math.trunc(Number(d.cantidad));
        await descontarStockOrigenTransferencia(db, d.costo_id, cantidad, sucursalOrigenId);
        descontados.push({ ...d, cantidad });
      }

      const filasDetalle = descontados.map((d) => ({
        transferencia_id: transferenciaId,
        prenda_id: d.prenda_id,
        talla_id: d.talla_id,
        cantidad: d.cantidad,
        costo_id: d.costo_id,
        estado: 'EN_TRANSITO',
      }));

      const { error: errIns } = await db.from('detalle_transferencias').insert(filasDetalle);
      if (errIns) throw new Error(errIns.message);

      const { data: actualizada, error: errUp } = await db
        .from('transferencias')
        .update({
          observaciones: body.observaciones?.trim() || null,
          estado: 'EN_TRANSITO',
        })
        .eq('id', transferenciaId)
        .select('*')
        .single();
      if (errUp) throw new Error(errUp.message);

      return NextResponse.json({ ok: true, transferencia: actualizada });
    } catch (e) {
      // Intentar reponer lo recién descontado si falló a mitad
      for (const d of descontados.reverse()) {
        try {
          await reponerStockOrigenTransferencia(db, d.costo_id, d.cantidad, sucursalOrigenId);
        } catch (rollbackErr) {
          console.error('Rollback modificar transferencia falló', d.costo_id, rollbackErr);
        }
      }
      throw e;
    }
  } catch (e) {
    console.error('POST /api/transferencias/modificar', e);
    const message = e instanceof Error ? e.message : 'Error al modificar transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

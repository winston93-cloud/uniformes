import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import {
  abonarStockDestinoTransferencia,
  descontarStockOrigenTransferencia,
} from '@/lib/transferenciasStock';

function estadoLinea(raw: unknown) {
  return String(raw ?? 'EN_TRANSITO').toUpperCase();
}

async function recalcularEstado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  transferenciaId: string
) {
  const { data: detalles, error } = await db
    .from('detalle_transferencias')
    .select('estado')
    .eq('transferencia_id', transferenciaId);
  if (error) throw error;
  const estados = (detalles || []).map((d: { estado?: string }) => estadoLinea(d.estado));
  if (estados.length === 0) return 'EN_TRANSITO';
  if (estados.every((e: string) => e === 'RECIBIDA')) return 'RECIBIDA';
  if (estados.some((e: string) => e === 'EN_TRANSITO' || e === 'PENDIENTE')) return 'EN_TRANSITO';
  if (estados.some((e: string) => e === 'EN_TRANSITO_COMPLEMENTARIO')) return 'RECIBIDA_PARCIAL';
  return 'EN_TRANSITO';
}

/** Destino recibe una sola partida (complementaria o en tránsito tras reenvío). */
export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      transferencia_id?: string;
      detalle_id?: string;
    };
    const transferenciaId = String(body.transferencia_id ?? '').trim();
    const detalleId = String(body.detalle_id ?? '').trim();
    if (!transferenciaId || !detalleId) {
      return NextResponse.json({ ok: false, message: 'Falta transferencia_id o detalle_id.' }, { status: 400 });
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
        { ok: false, message: 'Solo la sucursal destino puede recibir partidas.' },
        { status: 403 }
      );
    }

    if (transferencia.estado === 'RECIBIDA' || transferencia.estado === 'CANCELADA') {
      return NextResponse.json({ ok: false, message: 'Esta transferencia ya no admite recepción.' }, { status: 409 });
    }

    const { data: detalle, error: errD } = await db
      .from('detalle_transferencias')
      .select('*')
      .eq('id', detalleId)
      .eq('transferencia_id', transferenciaId)
      .single();
    if (errD || !detalle) {
      return NextResponse.json({ ok: false, message: 'Partida no encontrada.' }, { status: 404 });
    }

    const est = estadoLinea(detalle.estado);
    if (est !== 'EN_TRANSITO_COMPLEMENTARIO' && est !== 'EN_TRANSITO' && est !== 'PENDIENTE') {
      return NextResponse.json(
        { ok: false, message: `Esta partida no se puede recibir (estado: ${est}).` },
        { status: 400 }
      );
    }

    const cantidad = Math.trunc(Number(detalle.cantidad ?? 0));
    const costoId = detalle.costo_id ? String(detalle.costo_id) : '';
    if (!costoId || cantidad <= 0) {
      return NextResponse.json({ ok: false, message: 'Partida incompleta.' }, { status: 400 });
    }

    const sucursalOrigenId = String(transferencia.sucursal_origen_id ?? '');
    const sucursalDestinoId = String(transferencia.sucursal_destino_id);

    // Complementario: el stock ya había vuelto al origen → descontar de nuevo al recibir
    if (est === 'EN_TRANSITO_COMPLEMENTARIO') {
      if (!sucursalOrigenId) {
        return NextResponse.json({ ok: false, message: 'Transferencia sin sucursal origen.' }, { status: 400 });
      }
      await descontarStockOrigenTransferencia(db, costoId, cantidad, sucursalOrigenId);
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

    const { error: errUp } = await db
      .from('detalle_transferencias')
      .update({ estado: 'RECIBIDA' })
      .eq('id', detalleId);
    if (errUp) throw new Error(errUp.message);

    const nuevoEstado = await recalcularEstado(db, transferenciaId);
    const { data: actualizada, error: errCab } = await db
      .from('transferencias')
      .update({ estado: nuevoEstado })
      .eq('id', transferenciaId)
      .select('*')
      .single();
    if (errCab) throw new Error(errCab.message);

    return NextResponse.json({
      ok: true,
      transferencia: actualizada,
      estado: nuevoEstado,
      detalle_id: detalleId,
    });
  } catch (e) {
    console.error('POST /api/transferencias/recibir-partida', e);
    const message = e instanceof Error ? e.message : 'Error al recibir la partida.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

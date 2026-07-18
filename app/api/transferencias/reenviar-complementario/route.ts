import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { descontarStockOrigenTransferencia } from '@/lib/transferenciasStock';

type LineaBody = {
  prenda_id: string;
  talla_id: string;
  cantidad: number;
  costo_id: string;
};

async function recalcularEstadoTransferencia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  transferenciaId: string
) {
  const { data: detalles, error } = await db
    .from('detalle_transferencias')
    .select('id, estado')
    .eq('transferencia_id', transferenciaId);
  if (error) throw error;

  const estados = (detalles || []).map((d: { estado?: string }) =>
    String(d.estado ?? 'EN_TRANSITO').toUpperCase()
  );
  if (estados.length === 0) return 'EN_TRANSITO';

  const todosRecibidos = estados.every((e: string) => e === 'RECIBIDA');
  if (todosRecibidos) return 'RECIBIDA';

  const hayEnTransito = estados.some((e: string) => e === 'EN_TRANSITO' || e === 'PENDIENTE');
  if (hayEnTransito) return 'EN_TRANSITO';

  const hayComplementario = estados.some((e: string) => e === 'EN_TRANSITO_COMPLEMENTARIO');
  if (hayComplementario) return 'RECIBIDA_PARCIAL';

  return 'EN_TRANSITO';
}

export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      transferencia_id?: string;
      detalle_id?: string;
      /** Si no viene, reenvía la misma partida (prenda/talla/cantidad). */
      linea?: LineaBody;
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

    const sucursalOrigenId = String(transferencia.sucursal_origen_id ?? '');
    if (!sucursalOrigenId || sucursalOrigenId !== sesion.sucursal_id) {
      return NextResponse.json(
        { ok: false, message: 'Solo la sucursal origen puede corregir y reenviar.' },
        { status: 403 }
      );
    }

    if (transferencia.estado === 'RECIBIDA' || transferencia.estado === 'CANCELADA') {
      return NextResponse.json({ ok: false, message: `Estado no válido: ${transferencia.estado}` }, { status: 400 });
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

    if (String(detalle.estado ?? '').toUpperCase() !== 'EN_TRANSITO_COMPLEMENTARIO') {
      return NextResponse.json(
        { ok: false, message: 'Solo se pueden reenviar partidas en tránsito complementario.' },
        { status: 400 }
      );
    }

    let prendaId = String(detalle.prenda_id);
    let tallaId = String(detalle.talla_id);
    let costoId = detalle.costo_id ? String(detalle.costo_id) : '';
    let cantidad = Math.trunc(Number(detalle.cantidad ?? 0));

    if (body.linea) {
      prendaId = String(body.linea.prenda_id ?? '').trim();
      tallaId = String(body.linea.talla_id ?? '').trim();
      costoId = String(body.linea.costo_id ?? '').trim();
      cantidad = Math.trunc(Number(body.linea.cantidad));
      if (!prendaId || !tallaId || !costoId || cantidad <= 0) {
        return NextResponse.json(
          { ok: false, message: 'La línea corregida debe tener prenda, talla, costo y cantidad > 0.' },
          { status: 400 }
        );
      }
    }

    if (!costoId || cantidad <= 0) {
      return NextResponse.json({ ok: false, message: 'Partida incompleta para reenviar.' }, { status: 400 });
    }

    await descontarStockOrigenTransferencia(db, costoId, cantidad, sucursalOrigenId);

    const { error: errUp } = await db
      .from('detalle_transferencias')
      .update({
        prenda_id: prendaId,
        talla_id: tallaId,
        costo_id: costoId,
        cantidad,
        estado: 'EN_TRANSITO',
      })
      .eq('id', detalleId);
    if (errUp) throw new Error(errUp.message);

    const nuevoEstado = await recalcularEstadoTransferencia(db, transferenciaId);
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
      detalle_id: detalleId,
      estado: nuevoEstado,
    });
  } catch (e) {
    console.error('POST /api/transferencias/reenviar-complementario', e);
    const message = e instanceof Error ? e.message : 'Error al reenviar partida.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

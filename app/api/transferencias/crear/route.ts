import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { abonarStockDestinoTransferencia, descontarStockOrigenTransferencia } from '@/lib/transferenciasStock';

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
      sucursal_origen_id?: string;
      sucursal_destino_id?: string;
      observaciones?: string;
      detalles?: LineaTransferencia[];
    };

    const sucursalOrigenId = String(body.sucursal_origen_id ?? sesion.sucursal_id).trim();
    const sucursalDestinoId = String(body.sucursal_destino_id ?? '').trim();
    const detalles = Array.isArray(body.detalles) ? body.detalles : [];

    if (!sucursalOrigenId) {
      return NextResponse.json({ ok: false, message: 'Selecciona sucursal origen.' }, { status: 400 });
    }
    if (sucursalOrigenId !== sesion.sucursal_id) {
      return NextResponse.json(
        { ok: false, message: 'Solo puedes enviar mercancía desde tu tienda activa.' },
        { status: 403 }
      );
    }
    if (!sucursalDestinoId) {
      return NextResponse.json({ ok: false, message: 'Selecciona sucursal destino.' }, { status: 400 });
    }
    if (sucursalDestinoId === sucursalOrigenId) {
      return NextResponse.json({ ok: false, message: 'Origen y destino deben ser distintos.' }, { status: 400 });
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

    const { data: origen, error: errOrigen } = await db
      .from('sucursales')
      .select('id, activo')
      .eq('id', sucursalOrigenId)
      .maybeSingle();
    if (errOrigen || !origen?.id || origen.activo === false) {
      return NextResponse.json({ ok: false, message: 'Sucursal origen no válida.' }, { status: 400 });
    }

    const { data: destino, error: errDestino } = await db
      .from('sucursales')
      .select('id, activo')
      .eq('id', sucursalDestinoId)
      .maybeSingle();
    if (errDestino || !destino?.id || destino.activo === false) {
      return NextResponse.json({ ok: false, message: 'Sucursal destino no válida.' }, { status: 400 });
    }

    const descontados: LineaTransferencia[] = [];

    try {
      for (const d of detalles) {
        const cantidad = Math.trunc(Number(d.cantidad));
        await descontarStockOrigenTransferencia(db, d.costo_id, cantidad, sucursalOrigenId);
        descontados.push({ ...d, cantidad });
      }

      const { data: transferencia, error: errTrans } = await db
        .from('transferencias')
        .insert([
          {
            sucursal_origen_id: sucursalOrigenId,
            sucursal_destino_id: sucursalDestinoId,
            usuario_id: null,
            estado: 'EN_TRANSITO',
            observaciones: body.observaciones?.trim() || null,
            folio: '',
          },
        ])
        .select('*')
        .single();

      if (errTrans || !transferencia?.id) {
        throw new Error(errTrans?.message ?? 'No se pudo crear la transferencia.');
      }

      const transferenciaId = String(transferencia.id);
      const filasDetalle = detalles.map((d) => ({
        transferencia_id: transferenciaId,
        prenda_id: d.prenda_id,
        talla_id: d.talla_id,
        cantidad: Math.trunc(Number(d.cantidad)),
        costo_id: d.costo_id,
        estado: 'EN_TRANSITO',
      }));

      const { error: errDet } = await db.from('detalle_transferencias').insert(filasDetalle);
      if (errDet) throw new Error(errDet.message);

      return NextResponse.json({ ok: true, transferencia });
    } catch (e) {
      for (const d of descontados.reverse()) {
        try {
          const { data: costoOrigen } = await db.from('costos').select('*').eq('id', d.costo_id).single();
          if (costoOrigen) {
            await abonarStockDestinoTransferencia(
              db,
              costoOrigen as Record<string, unknown>,
              sucursalOrigenId,
              d.cantidad
            );
          }
        } catch (rollbackErr) {
          console.error('Rollback transferencia falló para costo', d.costo_id, rollbackErr);
        }
      }
      throw e;
    }
  } catch (e) {
    console.error('POST /api/transferencias/crear', e);
    const message = e instanceof Error ? e.message : 'Error al crear transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

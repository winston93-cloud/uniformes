import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { rpcTransferencia } from '@/lib/transferenciasStock';

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

    const transferencia = await rpcTransferencia(getInsforge().database, 'transferencia_modificar', {
      p_transferencia_id: transferenciaId,
      p_sucursal_id: sesion.sucursal_id,
      p_observaciones: body.observaciones?.trim() || null,
      p_detalles: detalles.map((d) => ({
        prenda_id: d.prenda_id,
        talla_id: d.talla_id,
        cantidad: Math.trunc(Number(d.cantidad)),
        costo_id: d.costo_id,
      })),
    });

    return NextResponse.json({ ok: true, transferencia });
  } catch (e) {
    console.error('POST /api/transferencias/modificar', e);
    const message = e instanceof Error ? e.message : 'Error al modificar transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

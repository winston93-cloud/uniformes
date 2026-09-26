import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { rpcTransferencia } from '@/lib/transferenciasStock';

type LineaBody = {
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
      detalle_id?: string;
      /** Si no viene, reenvía la misma partida (prenda/talla/cantidad). */
      linea?: LineaBody;
    };

    const transferenciaId = String(body.transferencia_id ?? '').trim();
    const detalleId = String(body.detalle_id ?? '').trim();
    if (!transferenciaId || !detalleId) {
      return NextResponse.json({ ok: false, message: 'Falta transferencia_id o detalle_id.' }, { status: 400 });
    }

    let linea: LineaBody | null = null;
    if (body.linea) {
      linea = {
        prenda_id: String(body.linea.prenda_id ?? '').trim(),
        talla_id: String(body.linea.talla_id ?? '').trim(),
        costo_id: String(body.linea.costo_id ?? '').trim(),
        cantidad: Math.trunc(Number(body.linea.cantidad)),
      };
      if (!linea.prenda_id || !linea.talla_id || !linea.costo_id || linea.cantidad <= 0) {
        return NextResponse.json(
          { ok: false, message: 'La línea corregida debe tener prenda, talla, costo y cantidad > 0.' },
          { status: 400 }
        );
      }
    }

    const res = await rpcTransferencia<{ transferencia: unknown; estado: string; detalle_id: string }>(
      getInsforge().database,
      'transferencia_reenviar_complementario',
      {
        p_transferencia_id: transferenciaId,
        p_detalle_id: detalleId,
        p_sucursal_id: sesion.sucursal_id,
        p_linea: linea,
      }
    );

    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error('POST /api/transferencias/reenviar-complementario', e);
    const message = e instanceof Error ? e.message : 'Error al reenviar partida.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

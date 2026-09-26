import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { rpcTransferencia } from '@/lib/transferenciasStock';

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

    const res = await rpcTransferencia<{ transferencia: unknown; estado: string; detalle_id: string }>(
      getInsforge().database,
      'transferencia_recibir_partida',
      {
        p_transferencia_id: transferenciaId,
        p_detalle_id: detalleId,
        p_sucursal_id: sesion.sucursal_id,
      }
    );

    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error('POST /api/transferencias/recibir-partida', e);
    const message = e instanceof Error ? e.message : 'Error al recibir la partida.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

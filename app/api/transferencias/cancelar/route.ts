import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { rpcTransferencia } from '@/lib/transferenciasStock';

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

    const res = await rpcTransferencia<{ transferencia: unknown; unidades_repuestas: number }>(
      getInsforge().database,
      'transferencia_cancelar',
      { p_transferencia_id: transferenciaId, p_sucursal_id: sesion.sucursal_id }
    );

    return NextResponse.json({
      ok: true,
      transferencia: res.transferencia,
      unidades_repuestas: res.unidades_repuestas,
      message: `Transferencia cancelada. Se regresaron ${res.unidades_repuestas} unidad(es) al origen.`,
    });
  } catch (e) {
    console.error('POST /api/transferencias/cancelar', e);
    const message = e instanceof Error ? e.message : 'Error al cancelar transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { rpcTransferencia } from '@/lib/transferenciasStock';

export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      transferencia_id?: string;
      detalle_ids?: string[];
    };
    const transferenciaId = String(body.transferencia_id ?? '').trim();
    if (!transferenciaId) {
      return NextResponse.json({ ok: false, message: 'Falta transferencia_id.' }, { status: 400 });
    }

    const detalleIds = Array.isArray(body.detalle_ids)
      ? body.detalle_ids.map((id) => String(id).trim()).filter(Boolean)
      : [];

    const res = await rpcTransferencia<{
      transferencia: unknown;
      recibidas: number;
      noRecibidas: number;
      estado: string;
    }>(getInsforge().database, 'transferencia_recibir', {
      p_transferencia_id: transferenciaId,
      p_sucursal_id: sesion.sucursal_id,
      p_detalle_ids: detalleIds.length > 0 ? detalleIds : null,
    });

    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error('POST /api/transferencias/recibir', e);
    const message = e instanceof Error ? e.message : 'Error al recibir transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

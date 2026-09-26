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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      client_token?: string;
    };

    const sucursalOrigenId = String(body.sucursal_origen_id ?? sesion.sucursal_id).trim();
    const sucursalDestinoId = String(body.sucursal_destino_id ?? '').trim();
    const detalles = Array.isArray(body.detalles) ? body.detalles : [];
    const clientToken = String(body.client_token ?? '').trim();

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

    const { data: sucursales, error: errSuc } = await db
      .from('sucursales')
      .select('id, activo')
      .in('id', [sucursalOrigenId, sucursalDestinoId]);
    if (errSuc) throw new Error(errSuc.message);
    const activa = (id: string) =>
      (sucursales ?? []).some((s: { id: string; activo?: boolean }) => s.id === id && s.activo !== false);
    if (!activa(sucursalOrigenId)) {
      return NextResponse.json({ ok: false, message: 'Sucursal origen no válida.' }, { status: 400 });
    }
    if (!activa(sucursalDestinoId)) {
      return NextResponse.json({ ok: false, message: 'Sucursal destino no válida.' }, { status: 400 });
    }

    const transferencia = await rpcTransferencia(db, 'transferencia_crear', {
      p_sucursal_origen_id: sucursalOrigenId,
      p_sucursal_destino_id: sucursalDestinoId,
      p_observaciones: body.observaciones?.trim() || null,
      p_detalles: detalles.map((d) => ({
        prenda_id: d.prenda_id,
        talla_id: d.talla_id,
        cantidad: Math.trunc(Number(d.cantidad)),
        costo_id: d.costo_id,
      })),
      p_client_token: UUID_RE.test(clientToken) ? clientToken : null,
    });

    return NextResponse.json({ ok: true, transferencia });
  } catch (e) {
    console.error('POST /api/transferencias/crear', e);
    const message = e instanceof Error ? e.message : 'Error al crear transferencia.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

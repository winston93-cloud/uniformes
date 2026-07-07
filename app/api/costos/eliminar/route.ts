import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth-api';
import { getInsforge } from '@/lib/insforge';
import { normalizarCamposCostoApi } from '@/lib/costoQueries';
import { puedeGestionarCatalogo } from '@/lib/permisos';

function readStr(row: Record<string, unknown>, snake: string, camel: string): string {
  const v = row[snake] ?? row[camel];
  return v != null ? String(v).trim() : '';
}

async function contarPorCosto(db: ReturnType<typeof getInsforge>['database'], tabla: string, costoId: string) {
  const { count, error } = await db.from(tabla).select('id', { count: 'exact', head: true }).eq('costo_id', costoId);
  if (error) throw error;
  return count ?? 0;
}

export async function POST(req: Request) {
  const sesion = await exigirSesion();
  if (!sesion) {
    return NextResponse.json({ ok: false, message: 'Sesión requerida.' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { costo_id?: string; alcance_catalogo?: boolean };
    const costoId = String(body.costo_id ?? '').trim();
    const alcanceCatalogo = body.alcance_catalogo === true;
    if (!costoId) {
      return NextResponse.json({ ok: false, message: 'Falta costo_id.' }, { status: 400 });
    }

    const db = getInsforge().database;

    const { data: costoRaw, error: errCosto } = await db.from('costos').select('*').eq('id', costoId).maybeSingle();
    if (errCosto) throw errCosto;
    if (!costoRaw) {
      return NextResponse.json({ ok: false, message: 'Precio/talla no encontrado.' }, { status: 404 });
    }

    const costo = normalizarCamposCostoApi(costoRaw as Record<string, unknown>);
    const sucursalCosto = readStr(costo, 'sucursal_id', 'sucursalId');
    if (sucursalCosto && sucursalCosto !== sesion.sucursal_id) {
      const puedeCatalogo = alcanceCatalogo && puedeGestionarCatalogo(sesion);
      if (!puedeCatalogo) {
        return NextResponse.json(
          { ok: false, message: 'Solo puedes eliminar precios de tu sucursal activa.' },
          { status: 403 }
        );
      }
    }

    const [pedidos, transferencias] = await Promise.all([
      contarPorCosto(db, 'detalle_pedidos', costoId),
      contarPorCosto(db, 'detalle_transferencias', costoId),
    ]);

    if (pedidos > 0 || transferencias > 0) {
      const { error: errUp } = await db
        .from('costos')
        .update({ activo: false, stock: 0, stock_inicial: 0 })
        .eq('id', costoId);
      if (errUp) throw errUp;

      const motivo =
        pedidos > 0 && transferencias > 0
          ? 'tiene pedidos y transferencias asociados'
          : pedidos > 0
            ? 'tiene pedidos asociados'
            : 'tiene transferencias asociados';

      return NextResponse.json({
        ok: true,
        modo: 'desactivado',
        message: `La talla se desactivó (${motivo}) y ya no aparecerá para ventas nuevas.`,
      });
    }

    const { error: errMov } = await db.from('movimientos').delete().eq('costo_id', costoId);
    if (errMov) throw errMov;

    const { error: errDel } = await db.from('costos').delete().eq('id', costoId);
    if (errDel) throw errDel;

    return NextResponse.json({
      ok: true,
      modo: 'eliminado',
      message: 'Precio por talla eliminado correctamente.',
    });
  } catch (e) {
    console.error('POST /api/costos/eliminar', e);
    const message = e instanceof Error ? e.message : 'No se pudo eliminar el precio.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

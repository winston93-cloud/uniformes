import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';

function clampInt(v: unknown, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const costoId = String(body?.costo_id ?? '').trim();
    if (!costoId) {
      return NextResponse.json({ success: false, error: 'Falta costo_id' }, { status: 400 });
    }

    const stock = clampInt(body?.stock, 0);
    const stockMinimo = clampInt(body?.stock_minimo, 0);
    const partidasRaw = Array.isArray(body?.partidas) ? body.partidas : [];

    const partidas = partidasRaw
      .map((p: any) => ({
        ubicacion_almacenamiento_id: String(p?.ubicacion_almacenamiento_id ?? '').trim(),
        cantidad: clampInt(p?.cantidad, 0),
      }))
      .filter((p: any) => p.ubicacion_almacenamiento_id && p.cantidad > 0);

    const sum = partidas.reduce((s: number, p: any) => s + p.cantidad, 0);
    const omitirUbicaciones = body?.omitir_ubicaciones === true;

    if (!omitirUbicaciones) {
      if (stock === 0 && partidas.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Con stock en 0 no debe haber cantidades por ubicación.' },
          { status: 400 }
        );
      }
      if (stock > 0 && partidas.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Con stock mayor a 0, agrega al menos una ubicación y reparte la cantidad.' },
          { status: 400 }
        );
      }
      if (stock > 0 && sum !== stock) {
        return NextResponse.json(
          { success: false, error: `La suma por ubicación (${sum}) debe ser igual al stock existente (${stock}).` },
          { status: 400 }
        );
      }
    }

    const db = getInsforge().database;

    // Actualizar stock (fuente de verdad)
    const { error: upCostoErr } = await db
      .from('costos')
      .update({
        stock_inicial: stock,
        stock_minimo: stockMinimo,
        stock,
        ubicacion_almacenamiento_id: null,
      })
      .eq('id', costoId);
    if (upCostoErr) throw upCostoErr;

    // Reemplazar ubicaciones
    const { error: delErr } = await db.from('costo_ubicaciones').delete().eq('costo_id', costoId);
    if (delErr) throw delErr;

    if (partidas.length > 0) {
      const { error: insErr } = await db.from('costo_ubicaciones').insert(
        partidas.map((p: any) => ({
          costo_id: costoId,
          ubicacion_almacenamiento_id: p.ubicacion_almacenamiento_id,
          cantidad: p.cantidad,
        }))
      );
      if (insErr) throw insErr;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';

function isTaller(nombre: unknown) {
  return String(nombre ?? '').trim().toLowerCase() === 'taller';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const costoId = String(body?.costo_id ?? '').trim();
    if (!costoId) {
      return NextResponse.json({ success: false, error: 'Falta costo_id' }, { status: 400 });
    }

    const db = getInsforge().database;

    const { data: costo, error: costoErr } = await db
      .from('costos')
      .select('id, stock')
      .eq('id', costoId)
      .maybeSingle();
    if (costoErr) throw costoErr;
    if (!costo?.id) {
      return NextResponse.json({ success: false, error: 'Costo no encontrado' }, { status: 404 });
    }

    const stock = Math.max(0, Number((costo as any).stock ?? 0) || 0);

    const { data: ubRows, error: ubErr } = await db
      .from('costo_ubicaciones')
      .select('id, ubicacion_almacenamiento_id, cantidad, ubicaciones_almacenamiento(nombre)')
      .eq('costo_id', costoId);
    if (ubErr) throw ubErr;

    const filas = (ubRows ?? []) as Array<{
      id: string;
      ubicacion_almacenamiento_id: string;
      cantidad: number | null;
      ubicaciones_almacenamiento?: { nombre?: string | null } | null;
    }>;

    if (!filas.length) {
      return NextResponse.json({ success: true, costo_id: costoId, adjusted: false, note: 'Sin ubicaciones.' });
    }

    const sum = filas.reduce((s, f) => s + Math.max(0, Number(f.cantidad ?? 0) || 0), 0);
    const diff = stock - sum;
    if (diff === 0) {
      return NextResponse.json({ success: true, costo_id: costoId, adjusted: false, stock, sum });
    }

    // Orden: menor cantidad primero; empate Taller primero; luego por ubicacion id
    const ordenadas = [...filas].sort((a, b) => {
      const ca = Math.max(0, Number(a.cantidad ?? 0) || 0);
      const cb = Math.max(0, Number(b.cantidad ?? 0) || 0);
      if (ca !== cb) return ca - cb;
      const ta = isTaller(a.ubicaciones_almacenamiento?.nombre);
      const tb = isTaller(b.ubicaciones_almacenamiento?.nombre);
      if (ta !== tb) return ta ? -1 : 1;
      return String(a.ubicacion_almacenamiento_id).localeCompare(String(b.ubicacion_almacenamiento_id));
    });

    if (diff > 0) {
      // Falta en ubicaciones: sumar a la ubicación con menor (Taller en empate)
      const target = ordenadas[0];
      const cur = Math.max(0, Number(target.cantidad ?? 0) || 0);
      const nueva = cur + diff;
      const { error: upErr } = await db
        .from('costo_ubicaciones')
        .update({ cantidad: nueva })
        .eq('id', target.id);
      if (upErr) throw upErr;
    } else {
      // Sobra en ubicaciones: descontar recorriendo de menor a mayor
      let rem = -diff;
      for (const row of ordenadas) {
        if (rem <= 0) break;
        const cur = Math.max(0, Number(row.cantidad ?? 0) || 0);
        const take = Math.min(cur, rem);
        if (take <= 0) continue;
        const nueva = cur - take;
        // eslint-disable-next-line no-await-in-loop
        const { error: upErr } = await db
          .from('costo_ubicaciones')
          .update({ cantidad: nueva })
          .eq('id', row.id);
        if (upErr) throw upErr;
        rem -= take;
      }
      if (rem > 0) {
        throw new Error('No alcanzó para descontar el sobrante en ubicaciones.');
      }
    }

    return NextResponse.json({ success: true, costo_id: costoId, adjusted: true, stock, sum_before: sum });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


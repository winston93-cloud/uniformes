import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function parseIsoOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isTaller(nombre: unknown) {
  return String(nombre ?? '').trim().toLowerCase() === 'taller';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sinceRaw = body?.since ?? null; // e.g. "2026-04-25T00:00:00Z"
    const limitRaw = body?.limit ?? null; // seguridad
    const dryRun = Boolean(body?.dryRun ?? false);

    const since = parseIsoOrNull(sinceRaw) ?? '2026-04-25T00:00:00.000Z';
    const limit = Math.max(1, Math.min(5000, Number(limitRaw ?? 2000) || 2000));

    const supabaseAdmin = getSupabaseAdmin();

    // 1) costos afectados: costo_id con movimientos desde "since"
    const { data: movs, error: movErr } = await supabaseAdmin
      .from('movimientos')
      .select('costo_id')
      .not('costo_id', 'is', null)
      .gte('created_at', since)
      .limit(limit);
    if (movErr) throw movErr;

    const costoIds = Array.from(new Set((movs ?? []).map((m: any) => String(m.costo_id)).filter(Boolean)));
    if (costoIds.length === 0) {
      return NextResponse.json({ success: true, since, ajustados: 0, note: 'Sin movimientos desde esa fecha.' });
    }

    let ajustados = 0;
    let faltantesSumados = 0;
    let sobrantesDescontados = 0;
    let saltadosSinUbicaciones = 0;
    let errores = 0;

    for (const costoId of costoIds) {
      // 2) stock correcto (fuente de verdad)
      // eslint-disable-next-line no-await-in-loop
      const { data: costoRow, error: costoErr } = await supabaseAdmin
        .from('costos')
        .select('id, stock')
        .eq('id', costoId)
        .maybeSingle();
      if (costoErr) throw costoErr;
      if (!costoRow?.id) continue;

      const stock = Math.max(0, Number((costoRow as any).stock ?? 0) || 0);

      // 3) ubicaciones actuales + nombre de ubicación
      // eslint-disable-next-line no-await-in-loop
      const { data: ubRows, error: ubErr } = await supabaseAdmin
        .from('costo_ubicaciones')
        .select('id, costo_id, ubicacion_almacenamiento_id, cantidad, ubicaciones_almacenamiento(nombre)')
        .eq('costo_id', costoId);
      if (ubErr) throw ubErr;

      const filas = (ubRows ?? []) as Array<{
        id: string;
        ubicacion_almacenamiento_id: string;
        cantidad: number | null;
        ubicaciones_almacenamiento?: { nombre?: string | null } | null;
      }>;

      if (!filas.length) {
        saltadosSinUbicaciones += 1;
        continue;
      }

      const sum = filas.reduce((s, f) => s + Math.max(0, Number(f.cantidad ?? 0) || 0), 0);
      const diff = stock - sum;
      if (diff === 0) continue;

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

      try {
        if (diff > 0) {
          // sumar diff a la primera (menor / Taller)
          const target = ordenadas[0];
          const nueva = Math.max(0, Number(target.cantidad ?? 0) || 0) + diff;
          if (!dryRun) {
            // eslint-disable-next-line no-await-in-loop
            const { error: upErr } = await supabaseAdmin
              .from('costo_ubicaciones')
              .update({ cantidad: nueva })
              .eq('id', target.id);
            if (upErr) throw upErr;
          }
          ajustados += 1;
          faltantesSumados += 1;
        } else {
          // descontar -diff recorriendo ubicaciones de menor a mayor (Taller en empate)
          let rem = -diff;
          for (const row of ordenadas) {
            if (rem <= 0) break;
            const cur = Math.max(0, Number(row.cantidad ?? 0) || 0);
            const take = Math.min(cur, rem);
            if (take <= 0) continue;
            const nueva = cur - take;
            if (!dryRun) {
              // eslint-disable-next-line no-await-in-loop
              const { error: upErr } = await supabaseAdmin
                .from('costo_ubicaciones')
                .update({ cantidad: nueva })
                .eq('id', row.id);
              if (upErr) throw upErr;
            }
            rem -= take;
          }
          if (rem > 0) {
            throw new Error(`No alcanzó para descontar ${-diff} en costo_ubicaciones (costo_id=${costoId}).`);
          }
          ajustados += 1;
          sobrantesDescontados += 1;
        }
      } catch (e) {
        errores += 1;
      }
    }

    return NextResponse.json({
      success: true,
      since,
      costoIds: costoIds.length,
      ajustados,
      faltantes_sumados: faltantesSumados,
      sobrantes_descontados: sobrantesDescontados,
      saltados_sin_ubicaciones: saltadosSinUbicaciones,
      errores,
      dryRun,
      note: 'Reconciliación ejecutada sin depender de funciones SQL en DB.',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


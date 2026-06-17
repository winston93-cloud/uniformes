import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

/** Copia solo insumos.id + stock_minimo desde Supabase → InsForge (sin tocar el resto). */
export async function POST() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('insumos').select('id, stock_minimo');
    if (error) throw error;

    const rows = (data || []).filter(
      (r) => r?.id != null && Number(r.stock_minimo ?? 0) > 0
    );
    if (!rows.length) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: 'Supabase no devolvió insumos con stock_minimo > 0.',
      });
    }

    let updated = 0;
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = chunk
        .map((r) => {
          const id = String(r.id).replace(/'/g, "''");
          const sm = Number(r.stock_minimo ?? 0);
          return `('${id}'::uuid, ${sm}::numeric)`;
        })
        .join(',\n');

      await runInsforgeRawSql(`
        UPDATE public.insumos AS i
        SET stock_minimo = v.stock_minimo, updated_at = NOW()
        FROM (VALUES ${values}) AS v(id, stock_minimo)
        WHERE i.id = v.id;
      `);
      updated += chunk.length;
    }

    return NextResponse.json({ success: true, updated, totalWithMinimo: rows.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { copyTableDataFromSupabaseToInsforge } from '@/lib/migracion/copyTableData';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

/** Orden FK para copia inicial Bloque 5 (espejo). */
const BLOCK5_TABLES = [
  'sat_metodos_pago',
  'sat_formas_pago',
  'cotizaciones',
  'detalle_cotizacion',
  'pedidos',
  'detalle_pedidos',
  'movimientos',
  'snapshot_insumos_pedido',
] as const;

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    const body = await req.json().catch(() => ({}));
    const only = body?.table ? String(body.table).trim() : null;
    const tables = only ? [only] : [...BLOCK5_TABLES];
    const results: Record<string, unknown> = {};

    for (const table of tables) {
      if (!BLOCK5_TABLES.includes(table as (typeof BLOCK5_TABLES)[number])) {
        return NextResponse.json({ success: false, error: `Tabla no permitida: ${table}` }, { status: 400 });
      }
      const r = await copyTableDataFromSupabaseToInsforge({
        table,
        batchSize: 1000,
        chunkSize: 250,
        startOffset: 0,
        truncateDestination: true,
      });
      results[table] = r;
    }

    if (!only) {
      await runInsforgeRawSql(`
        SELECT setval(
          'public.cotizacion_folio_seq',
          COALESCE(
            (SELECT MAX(NULLIF(regexp_replace(folio, '.*-([0-9]+)$', '\\1'), folio)::bigint) FROM public.cotizaciones WHERE folio IS NOT NULL AND folio <> ''),
            0
          ),
          true
        );
      `);
      results._cotizacion_folio_seq = 'initialized';
    }

    return NextResponse.json({ success: true, tables: tables.length, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

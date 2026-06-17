import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { copyTableDataFromSupabaseToInsforge } from '@/lib/migracion/copyTableData';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

/** Orden FK: usuario → usuarios → cortes → transferencias → devoluciones */
const BLOCK6_10_TABLES = [
  'usuario',
  'usuarios',
  'cortes',
  'detalle_cortes',
  'transferencias',
  'detalle_transferencias',
  'devoluciones',
  'detalle_devoluciones',
] as const;

function formatErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const o = e as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    const body = await req.json().catch(() => ({}));
    const only = body?.table ? String(body.table).trim() : null;
    const tables = only ? [only] : [...BLOCK6_10_TABLES];
    const results: Record<string, unknown> = {};

    for (const table of tables) {
      if (!BLOCK6_10_TABLES.includes(table as (typeof BLOCK6_10_TABLES)[number])) {
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

    if (!only || only === 'usuario') {
      await runInsforgeRawSql(`
        SELECT setval(
          pg_get_serial_sequence('public.usuario', 'usuario_id'),
          GREATEST(COALESCE((SELECT MAX(usuario_id) FROM public.usuario), 0), 1),
          true
        );
      `);
      results._usuario_id_seq = 'initialized';
    }

    if (!only || only === 'devoluciones') {
      await runInsforgeRawSql(`
        SELECT setval(
          'public.devoluciones_folio_seq',
          GREATEST(COALESCE((SELECT MAX(folio) FROM public.devoluciones), 0), 1),
          true
        );
      `);
      results._devoluciones_folio_seq = 'initialized';
    }

    return NextResponse.json({ success: true, tables: tables.length, results });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: formatErr(e) }, { status: 500 });
  }
}

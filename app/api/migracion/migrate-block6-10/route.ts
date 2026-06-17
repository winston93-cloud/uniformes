import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { copyTableDataFromSupabaseToInsforge } from '@/lib/migracion/copyTableData';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

/** Orden FK: usuario → usuarios → cortes → transferencias → devoluciones → auditoría */
const BLOCK6_10_TABLES = [
  'usuario',
  'usuarios',
  'cortes',
  'detalle_cortes',
  'transferencias',
  'detalle_transferencias',
  'devoluciones',
  'detalle_devoluciones',
  'auditoria',
] as const;

function clampInt(v: unknown, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

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
    const startOffset = clampInt(body?.startOffset ?? 0, 0, 50_000_000);
    const maxPages = clampInt(body?.maxPages ?? (only === 'auditoria' ? 8 : 0), 0, 100);
    const truncateDestination =
      body?.truncateDestination !== false && startOffset === 0 && (!only || only !== 'auditoria' || body?.truncateDestination === true);
    const results: Record<string, unknown> = {};

    for (const table of tables) {
      if (!BLOCK6_10_TABLES.includes(table as (typeof BLOCK6_10_TABLES)[number])) {
        return NextResponse.json({ success: false, error: `Tabla no permitida: ${table}` }, { status: 400 });
      }
      const batchSize = 1000;
      const chunkSize = table === 'auditoria' ? 50 : 250;
      const r = await copyTableDataFromSupabaseToInsforge({
        table,
        batchSize,
        chunkSize,
        startOffset: table === 'auditoria' ? startOffset : 0,
        truncateDestination: table === 'auditoria' ? truncateDestination : true,
        auditoriaUniformesOnly: table === 'auditoria',
        maxPages: table === 'auditoria' ? maxPages : 0,
      });
      results[table] = r;
    }

    if ((!only || only === 'usuario') && startOffset === 0) {
      await runInsforgeRawSql(`
        SELECT setval(
          pg_get_serial_sequence('public.usuario', 'usuario_id'),
          GREATEST(COALESCE((SELECT MAX(usuario_id) FROM public.usuario), 0), 1),
          true
        );
      `);
      results._usuario_id_seq = 'initialized';
    }

    if ((!only || only === 'devoluciones') && startOffset === 0) {
      await runInsforgeRawSql(`
        SELECT setval(
          'public.devoluciones_folio_seq',
          GREATEST(COALESCE((SELECT MAX(folio) FROM public.devoluciones), 0), 1),
          true
        );
      `);
      results._devoluciones_folio_seq = 'initialized';
    }

    const aud = results.auditoria as { hasMore?: boolean; nextOffset?: number | null } | undefined;

    return NextResponse.json({
      success: true,
      tables: tables.length,
      results,
      auditoriaHasMore: aud?.hasMore === true,
      auditoriaNextOffset: aud?.nextOffset ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: formatErr(e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';
import { TABLAS_UNIFORMES } from '@/lib/migracion/uniformesTablas';

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
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

function parseCountFromInsforgeRawSql(json: unknown): number | null {
  const rowList =
    (json as { rows?: unknown[] })?.rows ??
    (json as { data?: unknown[] })?.data ??
    (json as { result?: { rows?: unknown[] } })?.result?.rows ??
    (json as { results?: { rows?: unknown[] } })?.results?.rows ??
    null;
  if (!Array.isArray(rowList) || rowList.length === 0) return null;
  const row = rowList[0];
  if (!row || typeof row !== 'object') return null;
  const v =
    (row as Record<string, unknown>).n ??
    (row as Record<string, unknown>).count ??
    (row as Record<string, unknown>).cnt ??
    Object.values(row)[0];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    const body = await req.json().catch(() => ({}));
    const table = String(body?.table || '').trim();
    if (!table || !isSafeTableName(table)) {
      return NextResponse.json({ success: false, error: 'Tabla inválida.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const uniformesOnly = table === 'auditoria';

    let supaCount: number | null = null;
    if (uniformesOnly) {
      const { count, error: supaErr } = await supabaseAdmin
        .from('auditoria')
        .select('*', { count: 'estimated', head: true })
        .in('tabla', [...TABLAS_UNIFORMES]);
      if (supaErr) throw supaErr;
      supaCount = typeof count === 'number' ? count : null;
    } else {
      const { count, error: supaErr } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (supaErr) throw supaErr;
      supaCount = typeof count === 'number' ? count : null;
    }

    const countRes = uniformesOnly
      ? await runInsforgeRawSql(
          `SELECT COUNT(*)::bigint AS n FROM public.auditoria WHERE tabla = ANY($1::text[])`,
          [[...TABLAS_UNIFORMES]]
        )
      : await runInsforgeRawSql(`SELECT COUNT(*)::bigint AS n FROM public.${table}`);
    const insforgeCount = parseCountFromInsforgeRawSql(countRes);

    if (insforgeCount === null) {
      throw new Error(
        `No se pudo obtener COUNT(*) desde InsForge (respuesta inesperada): ${JSON.stringify(countRes)?.slice(0, 800)}`
      );
    }

    return NextResponse.json({
      success: true,
      table,
      supabaseCount: supaCount,
      insforgeCount,
      match: typeof supaCount === 'number' ? supaCount === insforgeCount : null,
      insforgeCountSource: uniformesOnly ? 'rawsql_count_uniformes' : 'rawsql_count',
      scope: uniformesOnly ? 'uniformes_tablas' : 'full_table',
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: formatErr(e) }, { status: 500 });
  }
}

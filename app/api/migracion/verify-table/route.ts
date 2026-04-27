import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function parseCountFromInsforgeRawSql(json: any): number | null {
  const rowList =
    json?.rows ??
    json?.data ??
    json?.result?.rows ??
    json?.results?.rows ??
    null;
  if (!Array.isArray(rowList) || rowList.length === 0) return null;
  const row = rowList[0];
  if (!row || typeof row !== 'object') return null;
  const v =
    (row as any).n ??
    (row as any).count ??
    (row as any).cnt ??
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

    const { count: supaCount, error: supaErr } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (supaErr) throw supaErr;

    // InsForge / PostgREST no siempre expone count en el SDK como Supabase.
    // Conteo fiable vía SQL admin (mismo patrón que insforge-tables).
    const countRes = await runInsforgeRawSql(`SELECT COUNT(*)::bigint AS n FROM public.${table}`);
    const insforgeCount = parseCountFromInsforgeRawSql(countRes);

    if (insforgeCount === null) {
      throw new Error(
        `No se pudo obtener COUNT(*) desde InsForge (respuesta inesperada): ${JSON.stringify(countRes)?.slice(0, 800)}`
      );
    }

    return NextResponse.json({
      success: true,
      table,
      supabaseCount: typeof supaCount === 'number' ? supaCount : null,
      insforgeCount,
      match: typeof supaCount === 'number' ? supaCount === insforgeCount : null,
      insforgeCountSource: 'rawsql_count',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { TABLAS_MIGRACION_ORDER } from '@/lib/migracion/tablasOrder';

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

/** Verifica conteos SB vs IF para todas las tablas de migración (llama verify-table por tabla). */
export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    const body = await req.json().catch(() => ({}));
    const only = body?.table ? String(body.table).trim() : null;
    const tables = only ? [only] : [...TABLAS_MIGRACION_ORDER];

    const origin = new URL(req.url).origin;
    const results: Array<{
      table: string;
      match: boolean | null;
      supabaseCount: number | null;
      insforgeCount: number | null;
      error?: string;
    }> = [];

    for (const table of tables) {
      try {
        const res = await fetch(`${origin}/api/migracion/verify-table`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table }),
        });
        const json = await res.json();
        if (!json.success) {
          results.push({
            table,
            match: false,
            supabaseCount: null,
            insforgeCount: null,
            error: json.error || 'verify-table failed',
          });
          continue;
        }
        results.push({
          table,
          match: json.match,
          supabaseCount: json.supabaseCount,
          insforgeCount: json.insforgeCount,
        });
      } catch (e: unknown) {
        results.push({
          table,
          match: false,
          supabaseCount: null,
          insforgeCount: null,
          error: formatErr(e),
        });
      }
    }

    const mismatches = results.filter((r) => r.match === false);
    const unknown = results.filter((r) => r.match === null && !r.error);

    return NextResponse.json({
      success: mismatches.length === 0 && results.every((r) => !r.error),
      tables: results.length,
      matched: results.filter((r) => r.match === true).length,
      mismatches: mismatches.length,
      unknown: unknown.length,
      errors: results.filter((r) => r.error).length,
      results,
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: formatErr(e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { assertInsforgeConfigured, insforge } from '@/lib/insforge';

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
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

    // InsForge SDK puede o no soportar count/head. Intentamos y, si no, hacemos fallback con un select limitado.
    let insforgeCount: number | null = null;
    try {
      const { count, error } = await (insforge.database as any)
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      if (typeof count === 'number') insforgeCount = count;
    } catch {
      const { data, error } = await (insforge.database as any).from(table).select('*').limit(1);
      if (error) throw error;
      // No podemos contar sin API de count: reportamos "desconocido" pero confirmamos que existe.
      insforgeCount = Array.isArray(data) ? null : null;
    }

    return NextResponse.json({
      success: true,
      table,
      supabaseCount: typeof supaCount === 'number' ? supaCount : null,
      insforgeCount,
      match: typeof supaCount === 'number' && typeof insforgeCount === 'number' ? supaCount === insforgeCount : null,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


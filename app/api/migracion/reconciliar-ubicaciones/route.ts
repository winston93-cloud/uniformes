import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sinceRaw = body?.since ?? null; // e.g. "2026-04-25T00:00:00Z"

    const since =
      typeof sinceRaw === 'string' && sinceRaw.trim()
        ? sinceRaw.trim()
        : '2026-04-25T00:00:00Z';

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc('reconciliar_costo_ubicaciones_desde', {
      p_since: since,
    });
    if (error) throw error;

    return NextResponse.json(data ?? { success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSupabaseErrorMessage } from '@/lib/supabase';

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function supabaseHostFromUrl(url: string | undefined | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const desde = url.searchParams.get('desde'); // YYYY-MM-DD
    const hasta = url.searchParams.get('hasta'); // YYYY-MM-DD
    const tabla = url.searchParams.get('tabla');
    const operacion = url.searchParams.get('operacion'); // INSERT/UPDATE/DELETE

    const limit = clampInt(Number(url.searchParams.get('limit') || 100), 1, 500);
    const offset = clampInt(Number(url.searchParams.get('offset') || 0), 0, 50_000);

    let q = supabase
      .from('auditoria')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tabla && tabla.trim()) {
      q = q.eq('tabla', tabla.trim());
    }
    if (operacion && operacion.trim()) {
      q = q.eq('operacion', operacion.trim().toUpperCase());
    }
    if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      q = q.gte('timestamp', `${desde}T00:00:00.000Z`);
    }
    if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      q = q.lte('timestamp', `${hasta}T23:59:59.999Z`);
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      rows: data || [],
      count: count ?? null,
      limit,
      offset,
      debug: {
        supabaseHost: supabaseHostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
        serverNowIso: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: getSupabaseErrorMessage(err) },
      { status: 500 }
    );
  }
}


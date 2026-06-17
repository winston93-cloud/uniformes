import { NextResponse } from 'next/server';
import { insforge } from '@/lib/insforge';
import { getSupabaseErrorMessage } from '@/lib/supabase';
import { TABLAS_UNIFORMES } from '@/lib/migracion/uniformesTablas';

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function insforgeHostFromUrl(url: string | undefined | null) {
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
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    const tabla = url.searchParams.get('tabla');
    const operacion = url.searchParams.get('operacion');

    const limit = clampInt(Number(url.searchParams.get('limit') || 100), 1, 500);
    const offset = clampInt(Number(url.searchParams.get('offset') || 0), 0, 50_000);

    const now = new Date();
    const defaultDesde = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const defaultHasta = now.toISOString();

    let q = insforge.database
      .from('auditoria')
      .select('id,tabla,operacion,registro_id,registro_pk,usuario_id,timestamp,datos_anteriores,datos_nuevos')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tabla && tabla.trim()) {
      q = q.eq('tabla', tabla.trim());
    } else {
      q = q.in('tabla', [...TABLAS_UNIFORMES]);
    }
    if (operacion && operacion.trim()) {
      q = q.eq('operacion', operacion.trim().toUpperCase());
    }
    if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte('timestamp', `${desde}T00:00:00.000Z`);
    else q = q.gte('timestamp', defaultDesde);

    if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte('timestamp', `${hasta}T23:59:59.999Z`);
    else q = q.lte('timestamp', defaultHasta);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      rows: data || [],
      count: null,
      limit,
      offset,
      debug: {
        insforgeHost: insforgeHostFromUrl(process.env.NEXT_PUBLIC_INSFORGE_URL),
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

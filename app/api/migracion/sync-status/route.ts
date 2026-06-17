import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSyncState } from '@/lib/migracion/syncState';
import { TABLAS_UNIFORMES } from '@/lib/migracion/uniformesTablas';

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

export async function GET() {
  try {
    const state = await getSyncState();
    const baselineTs = state?.baseline_ts ?? null;
    const lastApplied = state?.last_applied_ts ?? baselineTs ?? null;

    if (!lastApplied) {
      return NextResponse.json({ success: true, baselineTs, lastAppliedTs: null, pendingCount: null });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { count, error } = await supabaseAdmin
      .from('auditoria')
      .select('*', { count: 'estimated', head: true })
      .gt('timestamp', lastApplied)
      .in('tabla', [...TABLAS_UNIFORMES]);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      baselineTs,
      lastAppliedTs: lastApplied,
      pendingCount: typeof count === 'number' ? count : null,
      source: 'supabase_auditoria_uniformes',
      note: 'Post-corte InsForge: pendientes SB→IF. Tras migración completa debería ser 0; nuevos cambios van a auditoría en InsForge.',
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: formatErr(e) }, { status: 500 });
  }
}

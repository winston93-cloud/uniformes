import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { copyTableDataFromSupabaseToInsforge } from '@/lib/migracion/copyTableData';
import { upsertSyncState } from '@/lib/migracion/syncState';

/**
 * Baseline: además de guardar ventana de sync, vuelca `auditoria` Supabase → InsForge
 * (la migración por tabla deja `auditoria` vacía a propósito).
 */
export async function POST() {
  try {
    assertInsforgeConfigured();
    const nowIso = new Date().toISOString();

    const auditoriaCopy = await copyTableDataFromSupabaseToInsforge({
      table: 'auditoria',
      truncateDestination: true,
    });

    await upsertSyncState({ baseline_ts: nowIso, last_applied_ts: nowIso });

    return NextResponse.json({
      success: true,
      baselineTs: nowIso,
      lastAppliedTs: nowIso,
      auditoriaFromSupabase: {
        totalRead: auditoriaCopy.totalRead,
        totalInserted: auditoriaCopy.totalInserted,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { upsertSyncState } from '@/lib/migracion/syncState';

/** Marca ventana de migración (legacy). Ya no usa bitácora/auditoría. */
export async function POST() {
  try {
    assertInsforgeConfigured();
    const nowIso = new Date().toISOString();
    await upsertSyncState({ baseline_ts: nowIso, last_applied_ts: nowIso });

    return NextResponse.json({
      success: true,
      baselineTs: nowIso,
      lastAppliedTs: nowIso,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

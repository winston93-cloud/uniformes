import { NextResponse } from 'next/server';
import { upsertSyncState } from '@/lib/migracion/syncState';

export async function POST() {
  try {
    const nowIso = new Date().toISOString();
    await upsertSyncState({ baseline_ts: nowIso, last_applied_ts: nowIso });
    return NextResponse.json({ success: true, baselineTs: nowIso, lastAppliedTs: nowIso });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


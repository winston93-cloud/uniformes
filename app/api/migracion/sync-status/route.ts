import { NextResponse } from 'next/server';
import { getSyncState } from '@/lib/migracion/syncState';

export async function GET() {
  try {
    const state = await getSyncState();
    const baselineTs = state?.baseline_ts ?? null;
    const lastApplied = state?.last_applied_ts ?? baselineTs ?? null;

    return NextResponse.json({
      success: true,
      baselineTs,
      lastAppliedTs: lastApplied,
      pendingCount: 0,
      note: 'Conciliación por auditoría desactivada (bitácora retirada).',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { copyTableDataFromSupabaseToInsforge } from '@/lib/migracion/copyTableData';

function clampInt(v: unknown, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    const body = await req.json().catch(() => ({}));
    const table = String(body?.table || '').trim();
    const batchSize = clampInt(body?.batchSize ?? 1000, 50, 5000);
    const chunkSize = clampInt(body?.chunkSize ?? 250, 25, 1000);
    const startOffset = clampInt(body?.startOffset ?? 0, 0, 10_000_000);

    if (!table || !isSafeTableName(table)) {
      return NextResponse.json({ success: false, error: 'Tabla inválida.' }, { status: 400 });
    }

    const r = await copyTableDataFromSupabaseToInsforge({ table, batchSize, chunkSize, startOffset, truncateDestination: true });
    return NextResponse.json({ success: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


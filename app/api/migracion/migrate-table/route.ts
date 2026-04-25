import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { assertInsforgeConfigured, insforge } from '@/lib/insforge';

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

    const supabaseAdmin = getSupabaseAdmin();

    let offset = startOffset;
    let totalRead = 0;
    let totalInserted = 0;

    for (;;) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      const rows = data || [];
      totalRead += rows.length;
      if (rows.length === 0) break;

      // Insertar en InsForge en chunks para evitar payloads grandes
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: insErr } = await insforge.database.from(table).insert(chunk);
        if (insErr) {
          throw new Error(`InsForge insert fallo en ${table}: ${insErr.message || String(insErr)}`);
        }
        totalInserted += chunk.length;
      }

      // Si no llenó el batch, terminamos.
      if (rows.length < batchSize) break;
      offset += batchSize;
    }

    return NextResponse.json({
      success: true,
      table,
      startOffset,
      endOffsetExclusive: offset + batchSize,
      totalRead,
      totalInserted,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


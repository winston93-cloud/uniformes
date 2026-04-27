import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { insforge } from '@/lib/insforge';

function clampInt(v: unknown, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

export async function copyTableDataFromSupabaseToInsforge(opts: {
  table: string;
  batchSize?: number;
  chunkSize?: number;
  startOffset?: number;
  truncateDestination?: boolean;
}) {
  const table = String(opts.table || '').trim();
  if (!table || !isSafeTableName(table)) {
    throw new Error('Tabla inválida.');
  }

  const batchSize = clampInt(opts.batchSize ?? 1000, 50, 5000);
  const chunkSize = clampInt(opts.chunkSize ?? 250, 25, 1000);
  const startOffset = clampInt(opts.startOffset ?? 0, 0, 10_000_000);
  const truncateDestination = opts.truncateDestination !== false;

  const supabaseAdmin = getSupabaseAdmin();

  // truncateDestination se maneja a nivel de migrate-one (delete+recreate tabla)
  void truncateDestination;

  let offset = startOffset;
  let totalRead = 0;
  let totalInserted = 0;

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    const rows = data || [];
    totalRead += rows.length;
    if (rows.length === 0) break;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      // eslint-disable-next-line no-await-in-loop
      const { error: insErr } = await insforge.database.from(table).insert(chunk);
      if (insErr) {
        throw new Error(`InsForge insert fallo en ${table}: ${insErr.message || JSON.stringify(insErr)}`);
      }
      totalInserted += chunk.length;
    }

    if (rows.length < batchSize) break;
    offset += batchSize;
  }

  return {
    table,
    startOffset,
    endOffsetExclusive: offset + batchSize,
    totalRead,
    totalInserted,
  };
}

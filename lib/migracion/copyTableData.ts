import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { insforge } from '@/lib/insforge';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

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

  // Descubrir columnas reales del destino (InsForge agrega `uuid`, `created_at`, etc.)
  // y puede no tener la misma PK/columna que Supabase (p.ej. `id`).
  const destColsRes = await runInsforgeRawSql<{ rows?: Array<{ column_name: string }> }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  const destCols = new Set((destColsRes?.rows || []).map((r) => String(r.column_name)));

  if (destCols.size === 0) {
    throw new Error(`InsForge table not found: public.${table}`);
  }

  const hasUuid = destCols.has('uuid');
  const hasId = destCols.has('id');

  const normalizeRowForInsforge = (row: any) => {
    if (!row || typeof row !== 'object') return row;
    const out: any = {};

    // Caso común: InsForge usa `uuid` como PK, Supabase usa `id`.
    // Si el destino NO tiene `id` pero sí `uuid`, mapeamos.
    if (!hasId && hasUuid && row.id !== undefined && out.uuid === undefined) {
      out.uuid = row.id;
    }

    for (const [k, v] of Object.entries(row)) {
      if (k === 'id' && !hasId && hasUuid) continue; // ya mapeado a uuid
      if (!destCols.has(k)) continue; // omitir columnas que no existen en destino
      out[k] = v;
    }
    return out;
  };

  const formatInsforgeInsertError = (insErr: any) => {
    if (!insErr) return 'Error desconocido';
    const msg = insErr?.message ? String(insErr.message) : '';
    const code = insErr?.code ? String(insErr.code) : '';
    const details = insErr?.details ? String(insErr.details) : '';
    const hint = insErr?.hint ? String(insErr.hint) : '';
    const own = (() => {
      try {
        const keys = Object.getOwnPropertyNames(insErr);
        const pick: any = {};
        for (const k of keys) pick[k] = (insErr as any)[k];
        return JSON.stringify(pick);
      } catch {
        return '';
      }
    })();
    return [code && `code=${code}`, msg, details && `details=${details}`, hint && `hint=${hint}`, own && `raw=${own}`]
      .filter(Boolean)
      .join(' · ');
  };

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
      const normalized = chunk.map(normalizeRowForInsforge);
      // eslint-disable-next-line no-await-in-loop
      const { error: insErr } = await insforge.database.from(table).insert(normalized);
      if (insErr) {
        throw new Error(`InsForge insert fallo en ${table}: ${formatInsforgeInsertError(insErr)}`);
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

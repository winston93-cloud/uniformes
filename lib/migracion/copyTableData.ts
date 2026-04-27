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

  const requiredColsRes = await runInsforgeRawSql<{
    rows?: Array<{ column_name: string; is_nullable: string; column_default: string | null }>;
  }>(
    `SELECT column_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND is_nullable = 'NO'
       AND column_default IS NULL`,
    [table]
  );
  const requiredCols = new Set((requiredColsRes?.rows || []).map((r) => String(r.column_name)));

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

  const safeJson = (v: any) => {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  const formatInsforgeInsertError = (insErr: any) => {
    if (insErr === null || insErr === undefined) return 'Error desconocido';
    if (typeof insErr === 'string') return insErr;

    // PostgrestError hereda Error: message/details/hint/code NO son enumerable con getOwnPropertyNames()
    const msg =
      typeof (insErr as any)?.message === 'string' && String((insErr as any).message).trim().length
        ? String((insErr as any).message)
        : '';
    const code = (insErr as any)?.code !== undefined && (insErr as any)?.code !== null ? String((insErr as any).code) : '';
    const details =
      (insErr as any)?.details !== undefined && (insErr as any)?.details !== null ? String((insErr as any).details) : '';
    const hint =
      (insErr as any)?.hint !== undefined && (insErr as any)?.hint !== null ? String((insErr as any).hint) : '';

    const extra = (() => {
      try {
        const out: Record<string, any> = {};
        const errObj = insErr as Record<string, unknown>;
        for (const k of Object.getOwnPropertyNames(insErr)) {
          out[k] = errObj[k];
        }
        // Captura props de Error aunque no salgan en ownPropertyNames en algunos runtimes
        if (!out.message && (insErr as any).message) out.message = (insErr as any).message;
        return safeJson(out);
      } catch {
        return String(insErr);
      }
    })();

    return [code && `code=${code}`, msg, details && `details=${details}`, hint && `hint=${hint}`, `raw=${extra}`]
      .filter(Boolean)
      .join(' · ');
  };

  const validateRequiredAfterNormalize = (rowOut: any) => {
    const missing: string[] = [];
    for (const c of requiredCols) {
      const v = rowOut?.[c];
      if (v === undefined || v === null) missing.push(c);
    }
    if (missing.length) {
      throw new Error(
        `Faltan columnas obligatorias en destino (${table}): ${missing.join(
          ', '
        )}. Revisa mapeo id/uuid y nombres de columnas vs InsForge.`
      );
    }
  };

  const insertSingleWithContext = async (rowIn: any, rowOut: any) => {
    const { error: insErr } = await insforge.database.from(table).insert([rowOut]);
    if (!insErr) return;
    const pk = rowIn?.id ?? rowIn?.uuid ?? rowIn?.usuario_id ?? '¿?';
    throw new Error(
      `InsForge insert fallo en ${table} (pk=${safeJson(pk)}): ${formatInsforgeInsertError(insErr)} · payload=${safeJson(
        rowOut
      ).slice(0, 1200)}`
    );
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
      const normalized = chunk.map((r) => {
        const out = normalizeRowForInsforge(r);
        validateRequiredAfterNormalize(out);
        return out;
      });
      // eslint-disable-next-line no-await-in-loop
      const { error: insErr } = await insforge.database.from(table).insert(normalized);
      if (insErr) {
        // Fallback: intentar fila por fila para ubicar el registro que truena y enseñar payload útil.
        // (Sigue siendo una sola interacción “humana”: el error ya trae pk + payload truncado.)
        // eslint-disable-next-line no-await-in-loop
        for (let k = 0; k < chunk.length; k += 1) {
          // eslint-disable-next-line no-await-in-loop
          await insertSingleWithContext(chunk[k], normalized[k]);
        }
        // Si el batch falló pero singles no, esto no debería pasar; dejamos error claro.
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

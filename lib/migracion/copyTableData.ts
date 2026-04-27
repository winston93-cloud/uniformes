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

function quoteIdent(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function pgCastForColumn(meta: { data_type: string; udt_name: string }): string {
  const dt = String(meta.data_type || '').toLowerCase();
  const udt = String(meta.udt_name || '').toLowerCase();

  if (dt === 'uuid' || udt === 'uuid') return 'uuid';

  if (dt === 'boolean') return 'boolean';

  if (dt === 'smallint') return 'smallint';
  if (dt === 'integer') return 'integer';
  if (dt === 'bigint') return 'bigint';

  if (dt === 'numeric' || dt === 'real' || dt === 'double precision') return 'numeric';

  if (dt === 'json' || udt === 'json') return 'json';
  if (dt === 'jsonb' || udt === 'jsonb') return 'jsonb';

  if (dt === 'date') return 'date';
  if (dt === 'timestamp with time zone') return 'timestamptz';
  if (dt === 'timestamp without time zone') return 'timestamp';
  if (dt.includes('timestamp')) return 'timestamptz';

  // USER-DEFINED (enums, etc.): llegan como texto desde JSON; Postgres los casteará si el texto coincide.
  if (dt === 'user-defined') return 'text';

  // varchar/text y el resto
  return 'text';
}

export async function copyTableDataFromSupabaseToInsforge(opts: {
  table: string;
  batchSize?: number;
  chunkSize?: number;
  startOffset?: number;
  truncateDestination?: boolean;
  /** Renombres aplicados solo en el fallback Tables API (columnas reservadas en InsForge). */
  tablesApiRename?: Record<string, string>;
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

  if (truncateDestination) {
    const fq = `public.${quoteIdent(table)}`;
    try {
      await runInsforgeRawSql(`TRUNCATE TABLE ${fq} RESTART IDENTITY`);
    } catch (truncateErr: any) {
      try {
        await runInsforgeRawSql(`DELETE FROM ${fq}`);
      } catch (delErr: any) {
        throw new Error(
          `No se pudo vaciar destino public.${table}: TRUNCATE ${truncateErr?.message || String(truncateErr)} · DELETE ${delErr?.message || String(delErr)}`
        );
      }
    }
  }

  const metaRes = await runInsforgeRawSql<{
    rows?: Array<{ column_name: string; data_type: string; udt_name: string }>;
  }>(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  const colMeta = new Map<string, { data_type: string; udt_name: string }>();
  for (const r of metaRes?.rows || []) {
    colMeta.set(String(r.column_name), { data_type: String(r.data_type), udt_name: String(r.udt_name) });
  }

  const requiredColsRes = await runInsforgeRawSql<{
    rows?: Array<{ column_name: string }>;
  }>(
    `SELECT column_name
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

  const tablesApiRename = opts.tablesApiRename || {};

  const normalizeRowForInsforge = (row: any) => {
    if (!row || typeof row !== 'object') return row;
    const out: any = {};

    // Si el DDL en InsForge renombró columnas reservadas, reflejarlo en los datos.
    for (const [from, to] of Object.entries(tablesApiRename)) {
      if (!from || !to) continue;
      if (!destCols.has(to)) continue;
      if (row?.[from] === undefined) continue;
      out[to] = row[from];
    }

    // Caso común: InsForge usa `uuid` como PK, Supabase usa `id`.
    // Si el destino NO tiene `id` pero sí `uuid`, mapeamos.
    if (!hasId && hasUuid && row.id !== undefined && out.uuid === undefined) {
      out.uuid = row.id;
    }

    for (const [k, v] of Object.entries(row)) {
      if (tablesApiRename[k]) continue; // ya movido arriba
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
      `InsForge insert (fallback PostgREST) fallo en ${table} (pk=${safeJson(pk)}): ${formatInsforgeInsertError(
        insErr
      )} · payload=${safeJson(rowOut).slice(0, 1200)}`
    );
  };

  /**
   * Insert masivo vía SQL admin: evita muchos edge-cases del cliente PostgREST durante migración.
   * Usamos json_to_recordset + casts explícitos por columnas del destino.
   */
  const insertChunkViaSql = async (normalized: any[]) => {
    if (normalized.length === 0) return;

    const keyUnion = new Set<string>();
    for (const r of normalized) {
      if (!r || typeof r !== 'object') continue;
      for (const k of Object.keys(r)) {
        if (destCols.has(k)) keyUnion.add(k);
      }
    }

    const insertCols = [...keyUnion].sort();
    if (insertCols.length === 0) {
      throw new Error(`InsForge SQL insert: no hay columnas compatibles para public.${table}`);
    }

    const jsonRows = normalized.map((r) => {
      const o: any = {};
      for (const c of insertCols) {
        o[c] = r?.[c] ?? null;
      }
      return o;
    });

    const recordsetCols = insertCols
      .map((c) => {
        const meta = colMeta.get(c) || { data_type: 'text', udt_name: 'text' };
        const cast = pgCastForColumn(meta);
        return `${quoteIdent(c)} ${cast}`;
      })
      .join(', ');

    const targetCols = insertCols.map((c) => quoteIdent(c)).join(', ');
    const jsonParam = JSON.stringify(jsonRows);

    const sql = `
INSERT INTO public.${quoteIdent(table)} (${targetCols})
SELECT ${insertCols.map((c) => `x.${quoteIdent(c)}`).join(', ')}
FROM json_to_recordset($1::json) AS x(${recordsetCols});
`;

    await runInsforgeRawSql(sql, [jsonParam]);
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
      let normalized = chunk.map((r) => {
        const out = normalizeRowForInsforge(r);
        validateRequiredAfterNormalize(out);
        return out;
      });
      if (table === 'auditoria' && destCols.has('id')) {
        const seen = new Set<string>();
        normalized = normalized.filter((row) => {
          const id = row?.id != null ? String(row.id) : '';
          if (!id) return true;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      }
      if (normalized.length === 0) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        await insertChunkViaSql(normalized);
      } catch (sqlErr: any) {
        // Fallback conservador (no rompe el flujo anterior): PostgREST + row-level para aislar PK conflictivo.
        const { error: insErr } = await insforge.database.from(table).insert(normalized);
        if (insErr) {
          // eslint-disable-next-line no-await-in-loop
          for (let k = 0; k < chunk.length; k += 1) {
            try {
              // eslint-disable-next-line no-await-in-loop
              await insertSingleWithContext(chunk[k], normalized[k]);
            } catch (rowErr: any) {
              throw new Error(
                `${rowErr?.message || String(rowErr)}\n\nSQL batch previo falló: ${sqlErr?.message || String(sqlErr)}`
              );
            }
          }
          throw new Error(`InsForge insert fallo en ${table}: ${formatInsforgeInsertError(insErr)}`);
        }
      }

      totalInserted += normalized.length;
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

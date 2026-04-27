import { assertInsforgeConfigured } from '@/lib/insforge';
import { insforgeCreateTable, type InsforgeColumn } from '@/lib/insforgeAdminTables';
import {
  sanitizeCreateTableSqlForInsforgeTablesApi,
  type InsforgeTablesApiRenameMap,
} from '@/lib/migracion/insforgeTablesApiSanitize';
import { extractFirstPublicCreateTable } from '@/lib/migracion/extractPublicCreateTable';

function slugFromTableForInsforge(table: string) {
  const t = String(table || '').replace(/[^a-zA-Z0-9]+/g, '_');
  const parts = t.split('_').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'row';
}

/**
 * Última línea de defensa antes de POST /api/database/tables: InsForge reserva `id` (solo uuid),
 * y a menudo `created_at` / `updated_at`. Si el saneador SQL o el parser fallaron, igual no enviamos `id` entero.
 */
function enforceInsforgeTablesApiReservedColumns(
  columns: InsforgeColumn[],
  tableName: string
): { columns: InsforgeColumn[]; extraRename: InsforgeTablesApiRenameMap } {
  const short = slugFromTableForInsforge(tableName);
  const extraRename: InsforgeTablesApiRenameMap = {};
  const taken = new Set(columns.map((c) => c.name));

  const bump = (base: string) => {
    let out = base;
    let i = 2;
    while (taken.has(out)) {
      out = `${base}_${i}`;
      i += 1;
    }
    taken.add(out);
    return out;
  };

  const next = columns.map((col) => {
    if (col.name === 'id' && col.type !== 'uuid') {
      const nn = bump(`${short}_id`);
      extraRename.id = nn;
      return { ...col, name: nn };
    }
    if (col.name === 'created_at') {
      const nn = bump('created_src');
      extraRename.created_at = nn;
      return { ...col, name: nn };
    }
    if (col.name === 'updated_at') {
      const nn = bump('updated_src');
      extraRename.updated_at = nn;
      return { ...col, name: nn };
    }
    return col;
  });

  return { columns: next, extraRename };
}

/**
 * InsForge Tables API serializa defaultValue como literal; expresiones SQL (`CURRENT_TIMESTAMP`)
 * provocan: invalid input syntax for type timestamp with time zone: "CURRENT_TIMESTAMP".
 */
function sanitizeColumnDefaultsForInsforgeApi(columns: InsforgeColumn[]): InsforgeColumn[] {
  return columns.map((col) => {
    const raw = col.defaultValue;
    if (raw == null || String(raw).trim() === '') return { ...col, defaultValue: null };

    let v = String(raw).trim().replace(/,\s*$/, '');
    const vLower = v.toLowerCase();

    // Siempre: la API no acepta expresiones SQL como literal de fecha/uuid en JSON.
    if (vLower === 'current_timestamp' || /^now\s*\(\s*\)$/i.test(v)) {
      return { ...col, defaultValue: null };
    }

    // Literales entre comillas simples (Postgres)
    const sqlStringLiteral = /^'(?:[^']|'')*'$/;
    if (sqlStringLiteral.test(v)) {
      return { ...col, defaultValue: v };
    }

    if (col.type === 'datetime') {
      if (
        vLower === 'current_timestamp' ||
        vLower === 'current_date' ||
        vLower === 'current_time' ||
        vLower === 'localtimestamp' ||
        vLower === 'localtime' ||
        /^now\s*\(\s*\)$/.test(vLower) ||
        /^transaction_timestamp\s*\(\s*\)$/.test(vLower) ||
        /^statement_timestamp\s*\(\s*\)$/.test(vLower) ||
        /^clock_timestamp\s*\(\s*\)$/.test(vLower) ||
        /^timezone\s*\(/.test(vLower)
      ) {
        return { ...col, defaultValue: null };
      }
    }

    if (col.type === 'uuid') {
      if (/gen_random_uuid\s*\(|uuid_generate_v4\s*\(|random_uuid\s*\(/i.test(v)) {
        return { ...col, defaultValue: null };
      }
    }

    // Cualquier llamada a función u operador típico de SQL
    if (/[()]/.test(v)) {
      return { ...col, defaultValue: null };
    }

    // nextval, secuencias
    if (/nextval\s*\(/i.test(v)) return { ...col, defaultValue: null };

    return { ...col, defaultValue: v };
  });
}

type InsforgeMigrationResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  // backend puede regresar más campos; los ignoramos
  [k: string]: any;
};

function getInsforgeBaseUrl() {
  return process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL;
}

function getInsforgeAnonKey() {
  return process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_ANON_KEY;
}

function getInsforgeAdminToken() {
  return process.env.INSFORGE_ADMIN_TOKEN ?? process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN;
}

function makeVersion() {
  // YYYYMMDDHHmmss (UTC)
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

/**
 * InsForge: ejecuta SQL/DDL/relaciones (FK) en UNA transacción vía Admin API.
 * Documentación: `POST /api/database/migrations`
 */
export async function runInsforgeMigrationsSql(sql: string) {
  assertInsforgeConfigured();
  const baseUrl = getInsforgeBaseUrl();
  if (!baseUrl) throw new Error('Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL');
  const token = getInsforgeAdminToken() || getInsforgeAnonKey();
  if (!token) {
    throw new Error(
      'Falta token de InsForge para migraciones. Configura INSFORGE_ADMIN_TOKEN (recomendado) o NEXT_PUBLIC_INSFORGE_ANON_KEY.'
    );
  }

  // 1) Intentar endpoint de migrations (si está disponible en esta instancia)
  const body = {
    version: makeVersion(),
    name: 'uniformes_migracion',
    sql,
  };
  const migrationsPaths = ['/api/database/migrations', '/api/database/migrations/'];
  for (const path of migrationsPaths) {
    // eslint-disable-next-line no-await-in-loop
    const url = new URL(path, baseUrl).toString();
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
        apikey: token,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    // eslint-disable-next-line no-await-in-loop
    const text = await res.text();
    let json: InsforgeMigrationResponse | null = null;
    try {
      json = JSON.parse(text) as InsforgeMigrationResponse;
    } catch {
      // puede venir body HTML (404) o vacío
    }

    if (res.ok && !(json && json.success === false)) {
      return { ok: true, raw: text, json, mode: 'migrations', path };
    }

    // Si fue 404 o "Cannot POST", probamos fallback rawsql.
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    const looksLikeCannotPost =
      typeof msg === 'string' && msg.toLowerCase().includes('cannot post /api/database/migrations');
    if (res.status !== 404 && !looksLikeCannotPost) {
      throw new Error(`InsForge migrations fallo (HTTP ${res.status}): ${msg}`);
    }
  }

  // 2) Fallback: crear tabla vía Tables API (admin) cuando migrations POST no existe.
  // Soportamos CREATE TABLE sencillo para el caso de uniformes.
  const { sql: tablesSql, rename: tablesApiRename } = sanitizeCreateTableSqlForInsforgeTablesApi(sql);
  const parsed = parseCreateTableSqlForTablesApi(tablesSql);
  if (!parsed) {
    throw new Error(
      'InsForge no soporta POST /api/database/migrations en esta instancia y no pude convertir el SQL a Tables API.'
    );
  }
  const enforced = enforceInsforgeTablesApiReservedColumns(parsed.columns, parsed.tableName);
  const mergedRename: InsforgeTablesApiRenameMap = { ...tablesApiRename, ...enforced.extraRename };
  const columnsReady = sanitizeColumnDefaultsForInsforgeApi(enforced.columns);
  await insforgeCreateTable({ tableName: parsed.tableName, rlsEnabled: false, columns: columnsReady });
  return {
    ok: true,
    raw: JSON.stringify({ tableName: parsed.tableName }),
    json: null,
    mode: 'tables',
    path: '/api/database/tables',
    tablesApiRename: mergedRename,
  };
}

function parseCreateTableSqlForTablesApi(sql: string): { tableName: string; columns: InsforgeColumn[] } | null {
  const extracted = extractFirstPublicCreateTable(sql);
  let tableName: string;
  let body: string;

  if (!extracted) {
    // compat: intento regex legacy (peor con CHECK anidados)
    const m = sql.match(/create\s+table\s+if\s+not\s+exists\s+public\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*)\)\s*;?/i);
    if (!m) return null;
    tableName = m[1];
    body = m[2];
  } else {
    tableName = extracted.tableName;
    body = extracted.body;
  }

  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length && !l.startsWith('--'));

  const pkMatch = body.match(/primary\s+key\s*\(([^)]+)\)/i);
  const pkCols = pkMatch ? pkMatch[1].split(',').map((x) => x.trim().replace(/"/g, '')) : [];
  const pkCol = pkCols[0] || null;

  const columns: InsforgeColumn[] = [];
  for (const raw of lines) {
    if (/^constraint\b/i.test(raw)) continue;
    if (/^primary\s+key\b/i.test(raw)) continue;
    if (/^unique\b/i.test(raw)) continue;
    // cortar coma final
    const l = raw.replace(/,+$/, '');
    const cm2 = l.match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+(.+)$/);
    const name = cm2?.[1];
    const restLine = cm2?.[2];
    if (!name || !restLine) continue;

    // tipo: primera “palabra/pattern” hasta encontrar PRIMARY/UNIQUE/REFERENCES/CHECK/NOT NULL/DEFAULT/DEFERRABLE/COLLATE/COMMENT
    const typeMatch = restLine.match(
      /^([\s\S]*?)(\s+(?:primary\s+key|unique|references|check|not\s+null|null|default|collate)\b|\s*$)/i
    );
    const typeRaw0 = typeMatch?.[1]?.trim() || restLine.trim();
    const rest0 = restLine.slice(typeRaw0.length).trimStart();
    if (!name || !typeRaw0) continue;
    const typeRaw = typeRaw0.toLowerCase();
    const rest = (rest0 || '').toLowerCase();
    const nullable = !rest.includes('not null');
    const unique = rest.includes('unique') || (pkCol === name);
    const isPrimaryKey = pkCol === name;
    const defMatch = l.match(/\bdefault\b\s+(.+)$/i);
    const defaultValue = defMatch ? defMatch[1].trim() : null;

    const type = mapPgTypeToInsforge(typeRaw);
    columns.push({ name, type, nullable, unique, defaultValue, isPrimaryKey });
  }
  return { tableName, columns };
}

function mapPgTypeToInsforge(t: string): InsforgeColumn['type'] {
  if (t.startsWith('uuid')) return 'uuid';
  if (t.startsWith('timestamptz') || t.startsWith('timestamp')) return 'datetime';
  if (t.startsWith('date')) return 'datetime';
  if (t.startsWith('jsonb') || t.startsWith('json')) return 'json';
  if (t.startsWith('bool')) return 'boolean';
  if (t.startsWith('int') || t.startsWith('smallint') || t.startsWith('bigint') || t.startsWith('serial')) return 'integer';
  if (t.startsWith('numeric') || t.startsWith('decimal') || t.startsWith('real') || t.startsWith('double')) return 'float';
  return 'string';
}

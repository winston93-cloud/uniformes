import { assertInsforgeConfigured } from '@/lib/insforge';
import { insforgeCreateTable, type InsforgeColumn } from '@/lib/insforgeAdminTables';

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
  const parsed = parseCreateTableSqlForTablesApi(sql);
  if (!parsed) {
    throw new Error(
      'InsForge no soporta POST /api/database/migrations en esta instancia y no pude convertir el SQL a Tables API.'
    );
  }
  await insforgeCreateTable({ tableName: parsed.tableName, rlsEnabled: false, columns: parsed.columns });
  return { ok: true, raw: JSON.stringify({ tableName: parsed.tableName }), json: null, mode: 'tables', path: '/api/database/tables' };
}

function parseCreateTableSqlForTablesApi(sql: string): { tableName: string; columns: InsforgeColumn[] } | null {
  // CREATE TABLE IF NOT EXISTS public.<name> ( ... );
  const m = sql.match(/create\s+table\s+if\s+not\s+exists\s+public\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*)\)\s*;?/i);
  if (!m) return null;
  const tableName = m[1];
  const body = m[2];

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
    const cm2 = l.match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]+\))?)([\s\S]*)$/);
    const name = cm2?.[1];
    const typeRaw0 = cm2?.[2];
    const rest0 = cm2?.[3];
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

import { assertInsforgeConfigured } from '@/lib/insforge';

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

  // 2) Fallback: ejecutar como SQL raw (unrestricted)
  const rawUrl = new URL('/api/database/advance/rawsql/unrestricted', baseUrl).toString();
  const rawBody = { query: sql };
  const rawRes = await fetch(rawUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${token}`,
      apikey: token,
    },
    body: JSON.stringify(rawBody),
    cache: 'no-store',
  });
  const rawText = await rawRes.text();
  let rawJson: InsforgeMigrationResponse | null = null;
  try {
    rawJson = JSON.parse(rawText) as InsforgeMigrationResponse;
  } catch {
    // ignore
  }
  if (!rawRes.ok) {
    const msg = rawJson?.error || rawJson?.message || rawText || `HTTP ${rawRes.status}`;
    throw new Error(`InsForge rawsql fallo (HTTP ${rawRes.status}): ${msg}`);
  }
  return { ok: true, raw: rawText, json: rawJson, mode: 'rawsql', path: '/api/database/advance/rawsql/unrestricted' };
}

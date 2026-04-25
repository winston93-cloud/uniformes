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

  const url = new URL('/api/database/migrations', baseUrl).toString();
  // Docs: requiere JSON body {version, name, sql} y auth admin.
  const body = {
    version: makeVersion(),
    name: 'uniformes_migracion',
    sql,
  };
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

  const text = await res.text();
  let json: InsforgeMigrationResponse | null = null;
  try {
    json = JSON.parse(text) as InsforgeMigrationResponse;
  } catch {
    // puede venir body vacío o no-json
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(`InsForge migrations fallo (HTTP ${res.status}): ${msg}`);
  }
  if (json && json.success === false) {
    throw new Error(`InsForge migrations error: ${json.error || json.message || 'error'}`);
  }

  return { ok: true, raw: text, json };
}

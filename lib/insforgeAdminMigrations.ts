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

/**
 * InsForge: ejecuta SQL/DDL/relaciones (FK) en UNA transacción vía Admin API.
 * Documentación: `POST /api/database/migrations`
 */
export async function runInsforgeMigrationsSql(sql: string) {
  assertInsforgeConfigured();
  const baseUrl = getInsforgeBaseUrl();
  if (!baseUrl) throw new Error('Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL');
  const key = getInsforgeAnonKey();
  if (!key) throw new Error('Falta NEXT_PUBLIC_INSFORGE_ANON_KEY/INSFORGE_ANON_KEY');

  const url = new URL('/api/database/migrations', baseUrl).toString();
  // InsForge HttpClient setea `Authorization: Bearer <anonKey>` aunque no sea JWT;
  // replicamos el mismo patrón y añadimos `apikey` (PostgREST style) por compatibilidad.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: sql,
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
    throw new Error(`InsForge migrations fallo: ${msg}`);
  }
  if (json && json.success === false) {
    throw new Error(`InsForge migrations error: ${json.error || json.message || 'error'}`);
  }

  return { ok: true, raw: text, json };
}

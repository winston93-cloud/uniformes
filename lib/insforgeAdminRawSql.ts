import { assertInsforgeConfigured } from '@/lib/insforge';

function getInsforgeBaseUrl() {
  return process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL;
}

function getInsforgeAdminToken() {
  return process.env.INSFORGE_ADMIN_TOKEN ?? process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN;
}

export async function runInsforgeRawSql<T = any>(query: string, params?: any[]) {
  assertInsforgeConfigured();
  const baseUrl = getInsforgeBaseUrl();
  const token = getInsforgeAdminToken();
  if (!baseUrl) throw new Error('Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL');
  if (!token) throw new Error('Falta INSFORGE_ADMIN_TOKEN');

  const url = new URL('/api/database/advance/rawsql/unrestricted', baseUrl).toString();
  const payload: Record<string, unknown> = { query };
  // Solo enviar params cuando hay placeholders; evita edge-cases del backend con arrays vacíos.
  if (params !== undefined && params !== null && Array.isArray(params) && params.length > 0) {
    payload.params = params;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${token}`,
      apikey: token,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(`InsForge rawsql fallo (HTTP ${res.status}): ${msg}`);
  }
  return json as T;
}


import { assertInsforgeConfigured } from '@/lib/insforge';

function getInsforgeBaseUrl() {
  return process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL;
}

function getInsforgeAdminToken() {
  return process.env.INSFORGE_ADMIN_TOKEN ?? process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN;
}

function authHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    apikey: token,
    'x-api-key': token,
  } as Record<string, string>;
}

export type InsforgeColumn = {
  name: string;
  type: 'string' | 'datetime' | 'integer' | 'float' | 'boolean' | 'uuid' | 'json' | 'file';
  nullable: boolean;
  unique?: boolean;
  defaultValue?: string | null;
  // No está documentado en create, pero lo aceptan en schema GET; lo intentamos.
  isPrimaryKey?: boolean;
  foreignKey?: { table: string; column: string; onDelete?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT' };
};

export async function insforgeListTables(): Promise<string[]> {
  assertInsforgeConfigured();
  const baseUrl = getInsforgeBaseUrl();
  const token = getInsforgeAdminToken();
  if (!baseUrl) throw new Error('Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL');
  if (!token) throw new Error('Falta INSFORGE_ADMIN_TOKEN');

  const url = new URL('/api/database/tables', baseUrl).toString();
  const res = await fetch(url, { headers: authHeaders(token), cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new Error(`InsForge list tables fallo (HTTP ${res.status}): ${text}`);
  return JSON.parse(text) as string[];
}

export async function insforgeDeleteTable(tableName: string) {
  assertInsforgeConfigured();
  const baseUrl = getInsforgeBaseUrl();
  const token = getInsforgeAdminToken();
  if (!baseUrl) throw new Error('Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL');
  if (!token) throw new Error('Falta INSFORGE_ADMIN_TOKEN');

  const url = new URL(`/api/database/tables/${encodeURIComponent(tableName)}`, baseUrl).toString();
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token), cache: 'no-store' });
  if (res.status === 404) return;
  const text = await res.text();
  if (!res.ok) throw new Error(`InsForge delete table fallo (HTTP ${res.status}): ${text}`);
}

export async function insforgeCreateTable(opts: { tableName: string; rlsEnabled?: boolean; columns: InsforgeColumn[] }) {
  assertInsforgeConfigured();
  const baseUrl = getInsforgeBaseUrl();
  const token = getInsforgeAdminToken();
  if (!baseUrl) throw new Error('Falta NEXT_PUBLIC_INSFORGE_URL/INSFORGE_URL');
  if (!token) throw new Error('Falta INSFORGE_ADMIN_TOKEN');

  const url = new URL('/api/database/tables', baseUrl).toString();

  // Algunas instancias esperan el shape {columnName,isNullable,isUnique,defaultValue}
  // (consistente con Tables API schema). Enviamos ese shape.
  const payload = {
    tableName: opts.tableName,
    rlsEnabled: Boolean(opts.rlsEnabled),
    columns: (opts.columns || []).map((c) => {
      const out: any = {
        columnName: c.name,
        type: c.type,
        isNullable: c.nullable,
        isUnique: Boolean(c.unique),
      };
      if (c.defaultValue !== undefined && c.defaultValue !== null && String(c.defaultValue).length) {
        out.defaultValue = String(c.defaultValue);
      }
      if (c.foreignKey) {
        out.foreignKey = {
          referenceTable: c.foreignKey.table,
          referenceColumn: c.foreignKey.column,
          onDelete: c.foreignKey.onDelete || 'RESTRICT',
        };
      }
      return out;
    }),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`InsForge create table fallo (HTTP ${res.status}): ${text}`);
  return JSON.parse(text);
}


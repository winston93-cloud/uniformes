/**
 * InsForge Tables API marca como reservadas columnas típicas de Supabase (`id`, `created_at`,
 * `updated_at`) con reglas distintas (p.ej. `id` debe ser UUID).
 *
 * Este módulo adapta únicamente el DDL usado en el FALLBACK `POST /api/database/tables`
 * (cuando no existe `POST /api/database/migrations`).
 */

import { extractFirstPublicCreateTable } from '@/lib/migracion/extractPublicCreateTable';

export type InsforgeTablesApiRenameMap = Record<string, string>;

function slugFromTable(table: string) {
  const t = String(table || '').replace(/[^a-zA-Z0-9]+/g, '_');
  const parts = t.split('_').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'row';
}

export function sanitizeCreateTableSqlForInsforgeTablesApi(sql: string): {
  sql: string;
  rename: InsforgeTablesApiRenameMap;
} {
  const extracted = extractFirstPublicCreateTable(sql);
  if (!extracted) return { sql, rename: {} };

  const tableName = extracted.tableName;
  const body = extracted.body;
  const short = slugFromTable(tableName);

  const rename: InsforgeTablesApiRenameMap = {};
  const taken = new Set<string>();

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

  const lines = body.split('\n');

  // Sembrar nombres ya usados para evitar colisiones con renombres automáticos.
  for (const rawLine of lines) {
    const t = rawLine.trim();
    const colMatch = t.match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+/);
    if (colMatch?.[1]) taken.add(colMatch[1]);
  }

  const nextLines: string[] = [];

  const reservedCreated = bump('created_src');
  const reservedUpdated = bump('updated_src');

  for (let rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const t = line.trim();
    if (!t.length || t.startsWith('--')) {
      nextLines.push(line);
      continue;
    }

    // Solo renombrar líneas tipo columna al inicio (evita líneas CONSTRAINT sueltas aquí).
    const colMatch = t.match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+(.+)$/);
    if (!colMatch) {
      nextLines.push(line);
      continue;
    }

    const colName = colMatch[1];
    const rest = colMatch[2];

    let outName = colName;

    // created_at / updated_at: InsForge suele gestionar sus propios campos reservados.
    if (colName === 'created_at') {
      outName = reservedCreated;
      rename.created_at = outName;
    } else if (colName === 'updated_at') {
      outName = reservedUpdated;
      rename.updated_at = outName;
    } else if (colName === 'id') {
      // InsForge fuerza `id` como UUID (campo sistema). Mantener PK entera en otra columna.
      const next = bump(`${short}_id`);
      outName = next;
      rename.id = next;
      nextLines.push(line.replace(new RegExp(`^"?${colName}"?\\s+`, 'i'), `${quoteIdent(outName)} `));
      continue;
    }

    if (outName !== colName) {
      nextLines.push(line.replace(new RegExp(`^"?${colName}"?\\s+`, 'i'), `${quoteIdent(outName)} `));
    } else {
      nextLines.push(line);
    }
  }

  const rebuiltBody = nextLines.join('\n');

  const rebuiltFull = `${extracted.header}\n${rebuiltBody}\n);\n`;

  const marker = extracted.fullStatement;
  const markerIdx = sql.indexOf(marker);
  if (markerIdx >= 0) {
    const before = sql.slice(0, markerIdx);
    const after = sql.slice(markerIdx + marker.length);
    const outSql = `${before}${rebuiltFull}${after}`;
    return { sql: outSql, rename };
  }

  return { sql: rebuiltFull, rename };
}

function quoteIdent(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

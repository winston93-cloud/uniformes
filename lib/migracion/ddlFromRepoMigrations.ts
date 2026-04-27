import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractCreateTableStatementForTable } from '@/lib/migracion/extractPublicCreateTable';

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Busca DDL `CREATE TABLE ... public.<tabla>` en el repo:
 * - `supabase/migrations/*.sql`
 * - `supabase/*.sql` (scripts legacy fuera de migrations, ej. `crear_tabla_presentaciones.sql`)
 *
 * Si no aparece ahí, intenta `supabase/schema.sql` y normaliza a `public.<tabla>`.
 *
 * No intenta replicar TODA la evolución histórica: toma el fragmento CREATE TABLE tal cual.
 */
export async function extractCreateTableDdlForPublicTable(table: string) {
  if (!isSafeTableName(table)) throw new Error('Tabla inválida');

  function normalizeExtractedCreateTable(sql: string) {
    const s = sql.trim();
    // Si venía sin esquema, normalizar a public.<tabla> para el parser de InsForge.
    if (new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, 'i').test(s)) {
      return s
        .replace(
          new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, 'i'),
          `CREATE TABLE IF NOT EXISTS public.${table}`
        )
        .trim();
    }
    if (new RegExp(`CREATE\\s+TABLE\\s+${table}\\b`, 'i').test(s) && !/CREATE\s+TABLE\s+public\./i.test(s)) {
      return s.replace(new RegExp(`CREATE\\s+TABLE\\s+${table}\\b`, 'i'), `CREATE TABLE public.${table}`).trim();
    }
    return s;
  }

  async function scanDir(relDir: string, labelPrefix: string) {
    let dirFiles: string[] = [];
    try {
      dirFiles = (await readdir(join(process.cwd(), relDir)))
        .filter((f) => f.toLowerCase().endsWith('.sql'))
        .sort();
    } catch {
      return null;
    }

    const ordered = [
      ...dirFiles.filter((f) => f.toLowerCase().startsWith('create_')),
      ...dirFiles.filter((f) => !f.toLowerCase().startsWith('create_')),
    ];

    for (const f of ordered) {
      const text = await readFile(join(process.cwd(), relDir, f), 'utf8');
      const extracted = extractCreateTableStatementForTable(text, table);
      if (extracted) {
        return { file: `${labelPrefix}${f}`, sql: normalizeExtractedCreateTable(extracted).trim() + '\n' };
      }
    }
    return null;
  }

  const fromMigrations = await scanDir('supabase/migrations', '');
  if (fromMigrations) return fromMigrations;

  const fromSupabaseRoot = await scanDir('supabase', 'supabase/');
  if (fromSupabaseRoot) return fromSupabaseRoot;

  // Fallback: `supabase/schema.sql` suele contener el schema completo sin prefijo `public.`
  // (p. ej. "CREATE TABLE IF NOT EXISTS tallas (...)"). Lo normalizamos a `public.<tabla>`
  // porque nuestro parser de Tables API espera `public.<name>`.
  try {
    const schemaPath = join(process.cwd(), 'supabase', 'schema.sql');
    const schemaText = await readFile(schemaPath, 'utf8');
    const extracted = extractCreateTableStatementForTable(schemaText, table);
    if (extracted) {
      const raw = extracted.trim();
      const normalized = raw
        .replace(
          new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+(?:public\\.)?${table}\\b`, 'i'),
          `CREATE TABLE IF NOT EXISTS public.${table}`
        )
        .replace(new RegExp(`CREATE\\s+TABLE\\s+(?:public\\.)?${table}\\b`, 'i'), `CREATE TABLE public.${table}`);
      return { file: 'supabase/schema.sql', sql: normalized.trim() + '\n' };
    }
  } catch {
    // ignore
  }

  return null;
}

export function prependExtensionIfNeeded(sql: string) {
  const s = sql.toLowerCase();
  if (s.includes('gen_random_uuid(') && !s.includes('pgcrypto') && !s.includes('pgcrypto gen_random')) {
    return `CREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n${sql}`;
  }
  return sql;
}

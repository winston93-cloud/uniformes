import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Busca en `supabase/migrations/*.sql` el `CREATE TABLE ...` para public.<tabla>.
 * (No intenta replicar TODA la evolución histórica: toma el fragmento de CREATE TABLE
 *  tal como está en el repo, que normalmente es la estructura final o base.)
 */
export async function extractCreateTableDdlForPublicTable(table: string) {
  if (!isSafeTableName(table)) throw new Error('Tabla inválida');

  const dir = join(process.cwd(), 'supabase', 'migrations');
  const files = (await readdir(dir))
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();

  // Priorizar archivos “create_*”
  const ordered = [
    ...files.filter((f) => f.toLowerCase().startsWith('create_')),
    ...files.filter((f) => !f.toLowerCase().startsWith('create_')),
  ];

  const reTable = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.${table}\\b[\\s\\S]*?\\);`,
    'i'
  );
  // Variante sin IF NOT EXISTS (por si algún SQL legacy lo traía)
  const reTableLoose = new RegExp(`CREATE\\s+TABLE\\s+public\\.${table}\\b[\\s\\S]*?\\);`, 'i');

  for (const f of ordered) {
    const text = await readFile(join(dir, f), 'utf8');
    const m = text.match(reTable) || text.match(reTableLoose);
    if (m?.[0]) {
      return { file: f, sql: m[0].trim() + '\n' };
    }
  }

  // Fallback: `supabase/schema.sql` suele contener el schema completo sin prefijo `public.`
  // (p. ej. "CREATE TABLE IF NOT EXISTS tallas (...)"). Lo normalizamos a `public.<tabla>`
  // porque nuestro parser de Tables API espera `public.<name>`.
  try {
    const schemaPath = join(process.cwd(), 'supabase', 'schema.sql');
    const schemaText = await readFile(schemaPath, 'utf8');
    const reSchema = new RegExp(
      `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+(?:public\\.)?${table}\\b[\\s\\S]*?\\);`,
      'i'
    );
    const reSchemaLoose = new RegExp(`CREATE\\s+TABLE\\s+(?:public\\.)?${table}\\b[\\s\\S]*?\\);`, 'i');
    const mm = schemaText.match(reSchema) || schemaText.match(reSchemaLoose);
    if (mm?.[0]) {
      const raw = mm[0].trim();
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

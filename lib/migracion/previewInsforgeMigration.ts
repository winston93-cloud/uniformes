import { extractCreateTableDdlForPublicTable, prependExtensionIfNeeded } from '@/lib/migracion/ddlFromRepoMigrations';
import { extractReferencedPublicTablesFromDdl } from '@/lib/migracion/ddlReferencedTables';
import { previewDdlForInsforgeTablesApi } from '@/lib/insforgeAdminMigrations';

export type PreviewInsforgeRow = {
  table: string;
  /** Listo para el fallback Tables API (mismo criterio que usaría migrate-one si no hay POST migrations). */
  ok: boolean;
  ddlFile?: string;
  prerequisiteTables: string[];
  missingDdl?: string;
  tablesFallback?: ReturnType<typeof previewDdlForInsforgeTablesApi>;
};

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Prechequeo **sin llamar a InsForge**: resuelve DDL desde el repo y valida parseo/saneado del camino Tables API.
 * Si tu instancia tiene `POST /api/database/migrations`, la migración real puede tener éxito aunque esto marque fallo.
 */
export async function previewInsforgeTableMigration(table: string): Promise<PreviewInsforgeRow> {
  const t = String(table || '').trim();
  if (!t || !isSafeTableName(t)) {
    return { table: t || '(vacío)', ok: false, prerequisiteTables: [], missingDdl: 'Nombre de tabla inválido.' };
  }

  const extracted = await extractCreateTableDdlForPublicTable(t);
  if (!extracted) {
    return {
      table: t,
      ok: false,
      prerequisiteTables: [],
      missingDdl: `No encontré CREATE TABLE para public.${t} en supabase/migrations, supabase/*.sql ni schema.`,
    };
  }

  const ddl = prependExtensionIfNeeded(extracted.sql);
  const prerequisiteTables = extractReferencedPublicTablesFromDdl(ddl).filter((x) => x !== t);
  const tablesFallback = previewDdlForInsforgeTablesApi(ddl);
  const ok = tablesFallback.tablesApiParseOk && tablesFallback.issues.length === 0;

  return {
    table: t,
    ok,
    ddlFile: extracted.file,
    prerequisiteTables,
    tablesFallback,
  };
}

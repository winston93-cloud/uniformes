import { NextResponse } from 'next/server';
import { TABLAS_MIGRACION_ORDER } from '@/lib/migracion/tablasOrder';
import { extractCreateTableDdlForPublicTable } from '@/lib/migracion/ddlFromRepoMigrations';

/**
 * Lista qué tablas del plan de migración tienen CREATE TABLE en el repo (antes de llamar a InsForge).
 */
export async function GET() {
  try {
    const rows: Array<{ table: string; ok: boolean; ddlFile: string | null }> = [];
    for (const table of TABLAS_MIGRACION_ORDER) {
      // eslint-disable-next-line no-await-in-loop
      const extracted = await extractCreateTableDdlForPublicTable(table);
      rows.push({
        table,
        ok: !!extracted,
        ddlFile: extracted?.file ?? null,
      });
    }
    const missing = rows.filter((r) => !r.ok).map((r) => r.table);
    return NextResponse.json({
      success: true,
      rows,
      missing,
      missingCount: missing.length,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

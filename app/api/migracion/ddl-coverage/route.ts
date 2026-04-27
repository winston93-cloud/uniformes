import { NextResponse } from 'next/server';
import { TABLAS_MIGRACION_ORDER } from '@/lib/migracion/tablasOrder';
import {
  extractCreateTableDdlForPublicTable,
  prependExtensionIfNeeded,
} from '@/lib/migracion/ddlFromRepoMigrations';
import { dryRunInsforgeTablesApiFromDdl } from '@/lib/insforgeAdminMigrations';

/**
 * Lista tablas con DDL en repo y valida el mismo pipeline que InsForge Tables API (sin red).
 */
export async function GET() {
  try {
    const rows: Array<{
      table: string;
      ok: boolean;
      ddlFile: string | null;
      pipelineOk: boolean | null;
      pipelineError: string | null;
    }> = [];
    for (const table of TABLAS_MIGRACION_ORDER) {
      // eslint-disable-next-line no-await-in-loop
      const extracted = await extractCreateTableDdlForPublicTable(table);
      if (!extracted) {
        rows.push({
          table,
          ok: false,
          ddlFile: null,
          pipelineOk: null,
          pipelineError: null,
        });
        continue;
      }
      const ddl = prependExtensionIfNeeded(extracted.sql);
      const dry = dryRunInsforgeTablesApiFromDdl(ddl);
      rows.push({
        table,
        ok: true,
        ddlFile: extracted.file,
        pipelineOk: dry.ok,
        pipelineError: dry.ok ? null : dry.error ?? 'Error desconocido',
      });
    }
    const missing = rows.filter((r) => !r.ok).map((r) => r.table);
    const pipelineFailures = rows
      .filter((r) => r.ok && r.pipelineOk === false)
      .map((r) => ({ table: r.table, error: r.pipelineError || '' }));
    return NextResponse.json({
      success: true,
      rows,
      missing,
      missingCount: missing.length,
      pipelineFailures,
      pipelineFailureCount: pipelineFailures.length,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

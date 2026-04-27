import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { insforgeDeleteTable } from '@/lib/insforgeAdminTables';
import { TABLAS_MIGRACION_ORDER } from '@/lib/migracion/tablasOrder';

/** Orden inverso al de migración: primero tablas dependientes, al final padres. */
const TABLAS_BORRADO_DESC = [...TABLAS_MIGRACION_ORDER].reverse();

const SYNC_STATE_TABLE = 'uniformes_migracion_state';

/**
 * Borra las 34 tablas del plan uniformes en InsForge + estado de sync/baseline.
 * POST — uso desde la UI de migración antes de reimportar todo.
 */
export async function POST() {
  try {
    assertInsforgeConfigured();

    const deleted: string[] = [];
    const failed: Array<{ table: string; error: string }> = [];

    for (const table of TABLAS_BORRADO_DESC) {
      try {
        await insforgeDeleteTable(table);
        deleted.push(table);
      } catch (e: any) {
        failed.push({ table, error: e?.message || String(e) });
      }
    }

    try {
      await insforgeDeleteTable(SYNC_STATE_TABLE);
      deleted.push(SYNC_STATE_TABLE);
    } catch (e: any) {
      failed.push({ table: SYNC_STATE_TABLE, error: e?.message || String(e) });
    }

    return NextResponse.json({
      success: failed.length === 0,
      order: TABLAS_BORRADO_DESC,
      deletedCount: deleted.length,
      deleted,
      failed,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

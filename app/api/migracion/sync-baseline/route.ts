import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeMigrationsSql } from '@/lib/insforgeAdminMigrations';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';
import { copyTableDataFromSupabaseToInsforge } from '@/lib/migracion/copyTableData';
import { extractCreateTableDdlForPublicTable, prependExtensionIfNeeded } from '@/lib/migracion/ddlFromRepoMigrations';
import { upsertSyncState } from '@/lib/migracion/syncState';

async function auditoriaTableExistsInInsforge(): Promise<boolean> {
  const r = await runInsforgeRawSql<{ rows?: Array<{ n: number }> }>(
    `SELECT 1 AS n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    ['auditoria']
  );
  return (r?.rows?.length ?? 0) > 0;
}

/**
 * Tras un wipe, `auditoria` no está: creamos solo esta tabla con el DDL del repo
 * (puede fallar si faltan tablas referenciadas, p. ej. `usuario` — entonces toca
 * «Crear estructuras» o migrar en orden).
 */
/** Evita 23505 si quedaron filas de un baseline fallido o réplica parcial. */
async function vaciarAuditoriaInsforgeAntesDelVolcado(): Promise<void> {
  await runInsforgeRawSql(`DELETE FROM public.auditoria`);
  const cnt = await runInsforgeRawSql<{ rows?: Array<{ c: string }> }>(
    `SELECT COUNT(*)::text AS c FROM public.auditoria`
  );
  const n = Number(String((cnt?.rows?.[0] as { c?: string })?.c ?? '0'));
  if (!Number.isFinite(n) || n !== 0) {
    throw new Error(
      `No se pudo vaciar public.auditoria antes del volcado (filas restantes=${String(n)}).`
    );
  }
}

async function ensureAuditoriaTableInInsforge(): Promise<{ created: boolean; ddlFile?: string }> {
  if (await auditoriaTableExistsInInsforge()) {
    return { created: false };
  }
  const extracted = await extractCreateTableDdlForPublicTable('auditoria');
  if (!extracted) {
    throw new Error(
      'No hay CREATE TABLE de public.auditoria en el repositorio. Usa «Crear estructuras en InsForge» primero.'
    );
  }
  const ddl = prependExtensionIfNeeded(extracted.sql);
  await runInsforgeMigrationsSql(ddl);
  return { created: true, ddlFile: extracted.file };
}

function baselineErrorHint(original: string): string {
  const msg = original.toLowerCase();
  if (
    msg.includes('foreign key') ||
    msg.includes('referenced') ||
    msg.includes('does not exist') ||
    msg.includes('violates')
  ) {
    return `${original}\n\nTras borrar todo InsForge: primero «Crear estructuras en InsForge» (o migra tablas en orden hasta que existan las FK necesarias), luego vuelve a iniciar baseline.`;
  }
  if (msg.includes('table not found') || msg.includes('public.auditoria')) {
    return `${original}\n\nSi acabas de vaciar InsForge, crea el esquema (botón Crear estructuras) o migra al menos las tablas de las que depende auditoría antes del baseline.`;
  }
  if (msg.includes('23505') || msg.includes('duplicate key')) {
    return `${original}\n\nSi persiste: en InsForge vacía manualmente public.auditoria o vuelve a «Borrar plan» y recrea esquema antes del baseline.`;
  }
  return original;
}

/**
 * Baseline: además de guardar ventana de sync, vuelca `auditoria` Supabase → InsForge
 * (la migración por tabla deja `auditoria` vacía a propósito).
 */
export async function POST() {
  try {
    assertInsforgeConfigured();
    const nowIso = new Date().toISOString();

    await ensureAuditoriaTableInInsforge();
    await vaciarAuditoriaInsforgeAntesDelVolcado();

    const auditoriaCopy = await copyTableDataFromSupabaseToInsforge({
      table: 'auditoria',
      truncateDestination: true,
    });

    await upsertSyncState({ baseline_ts: nowIso, last_applied_ts: nowIso });

    return NextResponse.json({
      success: true,
      baselineTs: nowIso,
      lastAppliedTs: nowIso,
      auditoriaFromSupabase: {
        totalRead: auditoriaCopy.totalRead,
        totalInserted: auditoriaCopy.totalInserted,
      },
    });
  } catch (e: any) {
    const raw = e?.message || String(e);
    return NextResponse.json({ success: false, error: baselineErrorHint(raw) }, { status: 500 });
  }
}


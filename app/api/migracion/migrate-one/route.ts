import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeMigrationsSql } from '@/lib/insforgeAdminMigrations';
import { insforgeDeleteTable } from '@/lib/insforgeAdminTables';
import { extractCreateTableDdlForPublicTable, prependExtensionIfNeeded } from '@/lib/migracion/ddlFromRepoMigrations';
import { copyTableDataFromSupabaseToInsforge } from '@/lib/migracion/copyTableData';

function isSafeTableName(name: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function extractReferencedPublicTablesFromDdl(ddl: string) {
  const refs = new Set<string>();
  const re = /REFERENCES\s+public\.([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  for (;;) {
    m = re.exec(ddl);
    if (!m) break;
    refs.add(m[1]);
  }
  return [...refs];
}

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    const body = await req.json().catch(() => ({}));
    const table = String(body?.table || '').trim();
    if (!table || !isSafeTableName(table)) {
      return NextResponse.json({ success: false, error: 'Tabla inválida.' }, { status: 400 });
    }

    const extracted = await extractCreateTableDdlForPublicTable(table);
    if (!extracted) {
      return NextResponse.json(
        {
          success: false,
          error:
            `No encontré CREATE TABLE para public.${table} en el repo (revisé supabase/migrations, supabase/*.sql y supabase/schema.sql). Agrega/ajusta el SQL o soporta introspección directa desde Postgres.`,
        },
        { status: 400 }
      );
    }

    const ddl = prependExtensionIfNeeded(extracted.sql);
    const prereq = extractReferencedPublicTablesFromDdl(ddl).filter((t) => t !== table);

    // Resetear tabla destino para evitar conflictos (plan de migración inicial)
    await insforgeDeleteTable(table);

    // 1) Crear estructura en InsForge (incluye FK inline del CREATE TABLE)
    try {
      await runInsforgeMigrationsSql(ddl);
    } catch (e1: any) {
        return NextResponse.json(
          {
            success: false,
            error: `No se pudo crear el esquema en InsForge: ${e1?.message || String(e1)}`,
            table,
            ddlFile: extracted.file,
            prerequisiteTables: prereq,
            ddl,
          },
          { status: 500 }
        );
    }

    // 2) Copiar datos
    const copy = await copyTableDataFromSupabaseToInsforge({ table, truncateDestination: true });

    return NextResponse.json({
      success: true,
      ddlFile: extracted.file,
      prerequisiteTables: prereq,
      ...copy,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

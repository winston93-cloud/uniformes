import { NextResponse } from 'next/server';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeMigrationsSql } from '@/lib/insforgeAdminMigrations';

function shouldIncludeMigration(filename: string) {
  const n = filename.toLowerCase();
  if (!n.endsWith('.sql')) return false;
  // Evitar RLS/policies/storage y triggers de auditoría, por ser específicos de Supabase o no requeridos para esquema base
  if (n.includes('rls')) return false;
  if (n.includes('storage')) return false;
  if (n.includes('auditoria_triggers')) return false;
  return true;
}

export async function GET() {
  try {
    assertInsforgeConfigured();

    const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
    const files = (await readdir(migrationsDir)).filter(shouldIncludeMigration).sort();

    const parts: string[] = [];
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      const sql = await readFile(join(migrationsDir, f), 'utf8');
      parts.push(`-- ===== ${f} =====\n${sql.trim()}\n`);
    }

    const mergedSql = parts.join('\n\n');

    return NextResponse.json({
      success: true,
      files,
      sql: mergedSql,
      note:
        'SQL generado desde supabase/migrations (filtrando rls/storage/auditoria_triggers). La ejecución en InsForge se hace vía `POST /api/database/migrations`.',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    assertInsforgeConfigured();

    const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
    const files = (await readdir(migrationsDir)).filter(shouldIncludeMigration).sort();

    const parts: string[] = [];
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      const sql = await readFile(join(migrationsDir, f), 'utf8');
      parts.push(sql.trim());
    }
    const mergedSql = parts.join('\n\n');

    try {
      await runInsforgeMigrationsSql(mergedSql);
      return NextResponse.json({ success: true, executed: true, files });
    } catch (e: any) {
      return NextResponse.json(
        {
          success: false,
          executed: false,
          error: e?.message || String(e),
          files,
          sql: mergedSql,
        },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


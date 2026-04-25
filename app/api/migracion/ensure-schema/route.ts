import { NextResponse } from 'next/server';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';

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
        'SQL generado desde supabase/migrations (filtrando rls/storage/auditoria_triggers). Se intentará ejecutar en InsForge vía RPC si existe una función compatible.',
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

    // Intentar ejecutar SQL en InsForge usando RPC. El nombre puede variar por instalación.
    // Probamos nombres comunes.
    const rpcCandidates = ['exec_sql', 'execute_sql', 'run_sql', 'sql'];
    let lastErr: any = null;
    for (const fn of rpcCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const { error } = await (insforge.database as any).rpc(fn, { sql: mergedSql });
      if (!error) {
        return NextResponse.json({ success: true, executed: true, rpc: fn, files });
      }
      lastErr = error;
    }

    // Si no hay RPC compatible, devolvemos el SQL para ejecutarlo manualmente en InsForge.
    return NextResponse.json({
      success: false,
      executed: false,
      error:
        'InsForge no expuso un RPC compatible para ejecutar SQL/DDL (se intentó: exec_sql/execute_sql/run_sql/sql).',
      rpcError: lastErr?.message || String(lastErr),
      files,
      sql: mergedSql,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


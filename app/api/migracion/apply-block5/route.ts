import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

const BLOCK5_FILES = [
  'block5-insforge-ddl.sql',
  'block5-insforge-triggers-rls.sql',
  'block5-insforge-rpcs.sql',
] as const;

/** Divide RPCs en bloques ejecutables (InsForge rawsql falla con ~33KB de una vez). */
export function splitBlock5RpcChunks(sql: string): string[] {
  const re = /(?=^CREATE OR REPLACE FUNCTION|^DROP TRIGGER|^CREATE TRIGGER|^GRANT EXECUTE|^COMMENT ON FUNCTION)/gm;
  const raw = sql.split(re).map((s) => s.trim()).filter(Boolean);
  const merged: string[] = [];

  for (const part of raw) {
    if (/^CREATE OR REPLACE FUNCTION/i.test(part)) {
      merged.push(part);
    } else if (/^(GRANT EXECUTE|COMMENT ON FUNCTION)/i.test(part) && merged.length > 0) {
      merged[merged.length - 1] += '\n' + part;
    } else if (/^(DROP TRIGGER|CREATE TRIGGER)/i.test(part)) {
      merged.push(part);
    } else if (merged.length > 0) {
      merged[merged.length - 1] += '\n' + part;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

export async function POST() {
  try {
    assertInsforgeConfigured();
    const scriptsDir = path.join(process.cwd(), 'scripts');
    const results: { file: string; ok: boolean; error?: string; chunks?: number }[] = [];

    for (const file of BLOCK5_FILES) {
      const full = path.join(scriptsDir, file);
      const sql = await readFile(full, 'utf8');
      const chunks = file === 'block5-insforge-rpcs.sql' ? splitBlock5RpcChunks(sql) : [sql];

      try {
        for (let i = 0; i < chunks.length; i++) {
          await runInsforgeRawSql(chunks[i]);
        }
        results.push({ file, ok: true, chunks: chunks.length });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ file, ok: false, error: msg, chunks: chunks.length });
        return NextResponse.json({ success: false, results, error: msg }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

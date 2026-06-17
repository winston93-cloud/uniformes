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

export async function POST() {
  try {
    assertInsforgeConfigured();
    const scriptsDir = path.join(process.cwd(), 'scripts');
    const results: { file: string; ok: boolean; error?: string }[] = [];

    for (const file of BLOCK5_FILES) {
      const full = path.join(scriptsDir, file);
      const sql = await readFile(full, 'utf8');
      try {
        await runInsforgeRawSql(sql);
        results.push({ file, ok: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ file, ok: false, error: msg });
        return NextResponse.json({ success: false, results, error: msg }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

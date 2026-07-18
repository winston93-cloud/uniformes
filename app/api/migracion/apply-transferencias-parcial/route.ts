import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

export async function POST() {
  try {
    assertInsforgeConfigured();
    const full = path.join(process.cwd(), 'scripts', 'transferencias-recibo-parcial.sql');
    const sql = await readFile(full, 'utf8');
    await runInsforgeRawSql(sql);
    return NextResponse.json({ success: true, file: 'transferencias-recibo-parcial.sql' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

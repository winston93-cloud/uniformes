import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertInsforgeConfigured } from '@/lib/insforge';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

async function apply() {
  assertInsforgeConfigured();
  const full = path.join(process.cwd(), 'scripts', 'transferencias-recibo-parcial.sql');
  const sql = await readFile(full, 'utf8');
  await runInsforgeRawSql(sql);
  return { success: true as const, file: 'transferencias-recibo-parcial.sql' };
}

export async function GET() {
  try {
    const data = await apply();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const data = await apply();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

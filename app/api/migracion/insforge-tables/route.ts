import { NextResponse } from 'next/server';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

import { TABLAS_UNIFORMES } from '@/lib/migracion/uniformesTablas';

const TABLAS_UNIFORMES_LIST = TABLAS_UNIFORMES;

export async function GET() {
  try {
    const q = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const r = await runInsforgeRawSql<{ rows?: Array<{ table_name: string }> }>(q);
    const tables = (r?.rows || []).map((x) => x.table_name).filter(Boolean);

    const allow = new Set<string>(TABLAS_UNIFORMES_LIST);
    const found = tables.filter((t) => allow.has(t));
    const missing = TABLAS_UNIFORMES_LIST.filter((t) => !tables.includes(t));
    const extras = tables.filter((t) => !allow.has(t));

    return NextResponse.json({
      success: true,
      totalPublicTables: tables.length,
      foundUniformes: found,
      missingUniformes: missing,
      extrasPublic: extras,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


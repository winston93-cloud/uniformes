import { NextResponse } from 'next/server';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';
import { assertInsforgeConfigured } from '@/lib/insforge';

export const runtime = 'nodejs';

/**
 * Inicializa (vacía) tablas de Producción Semanal en InsForge.
 * Orden: items -> plan -> semanas, para evitar FK errors.
 */
export async function POST() {
  try {
    assertInsforgeConfigured();

    const sql = `
      TRUNCATE TABLE
        public.produccion_plan_semanal_items,
        public.produccion_plan_semanal,
        public.semanas
      RESTART IDENTITY CASCADE;
    `;

    await runInsforgeRawSql(sql);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


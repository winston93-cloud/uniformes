import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';

export async function GET() {
  try {
    assertInsforgeConfigured();
    return NextResponse.json({
      success: true,
      message:
        'Migración InsForge completada (bloques 0–10). Runtime de la app en InsForge.\n\n' +
        'Herramientas /migracion: verify-all, migrate-block6-10 (auditoría), sync-baseline.\n' +
        'Supabase queda como respaldo histórico; copias con SUPABASE_SERVICE_ROLE_KEY.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

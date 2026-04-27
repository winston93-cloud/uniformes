import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';

export async function GET() {
  try {
    assertInsforgeConfigured();
    return NextResponse.json({
      success: true,
      message:
        'InsForge configurado para herramientas de migración (/migracion).\n\nLa app en producción usa Supabase vía lib/supabase.ts (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).\nPara copiar datos desde Supabase hacia InsForge mantén también SUPABASE_SERVICE_ROLE_KEY donde aplique.',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

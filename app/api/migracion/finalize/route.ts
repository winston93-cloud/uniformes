import { NextResponse } from 'next/server';
import { assertInsforgeConfigured } from '@/lib/insforge';

export async function GET() {
  try {
    assertInsforgeConfigured();
    // Nota: la app NO puede cambiar variables de entorno de Vercel desde aquí.
    // Este endpoint solo valida que InsForge está configurado y devuelve instrucciones.
    return NextResponse.json({
      success: true,
      message:
        'Cutover en código listo.\n\nTu parte en Vercel:\n1) Variables: NEXT_PUBLIC_DATABASE_PROVIDER=insforge · NEXT_PUBLIC_INSFORGE_URL · NEXT_PUBLIC_INSFORGE_ANON_KEY.\n2) Mantén SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL para la página /migracion (origen de datos al copiar).\n3) Guardar proyecto → redeploy.\n\nLee CUTOVER_INSFORGE.md en el repo.',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


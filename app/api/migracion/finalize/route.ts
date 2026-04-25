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
        'Cutover listo.\n\nPara pasar TODO el sistema a InsForge:\n1) En Vercel, configura NEXT_PUBLIC_INSFORGE_URL y NEXT_PUBLIC_INSFORGE_ANON_KEY.\n2) (Recomendado) deshabilita/retira NEXT_PUBLIC_SUPABASE_* para evitar confusión.\n3) Redeploy.\n\nSiguiente paso: cambiar el código para que los hooks ya no usen Supabase. (Esto es un refactor grande y se hace en un commit separado.)',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


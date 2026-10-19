import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';

/** Ciclos escolares de Winston Servicios (solo lectura: se administran en Winston, no en Uniformes). */
export async function GET() {
  try {
    const { data, error } = await getInsforge()
      .database.from('ciclos_escolares')
      .select('id, valor, nombre, anio_inicio, anio_fin, activo, es_actual, created_at, updated_at')
      .order('valor', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, ciclos: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

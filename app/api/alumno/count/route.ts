import { NextResponse } from 'next/server';
import { getInsforgeAlumnos, alumnosInsforgeConfigured } from '@/lib/insforgeAlumnos';
import { getInsforge } from '@/lib/insforge';

function dbAlumnos() {
  if (alumnosInsforgeConfigured()) return getInsforgeAlumnos().database;
  return getInsforge().database;
}

export async function GET() {
  try {
    const { error, count } = await dbAlumnos()
      .from('alumno')
      .select('alumno_id', { count: 'exact', head: true })
      .eq('alumno_status', 1);
    if (error) throw error;
    return NextResponse.json({ success: true, count: count ?? 0 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

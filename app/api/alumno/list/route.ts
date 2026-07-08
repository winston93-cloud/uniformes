import { NextResponse } from 'next/server';
import { mapAlumnoRow } from '@/lib/alumnoMappers';
import { ciclosAlumnoParaBusqueda } from '@/lib/alumnoDisplay';
import { getInsforgeAlumnos, alumnosInsforgeConfigured } from '@/lib/insforgeAlumnos';
import { getInsforge } from '@/lib/insforge';

function dbAlumnos() {
  if (alumnosInsforgeConfigured()) return getInsforgeAlumnos().database;
  return getInsforge().database;
}

/** Lista inicial / catálogo de alumnos (Winston Servicios). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 1000);
    const cicloRaw = url.searchParams.get('ciclo');
    const cicloEscolar =
      cicloRaw != null && cicloRaw !== '' && Number.isFinite(Number(cicloRaw))
        ? Number(cicloRaw)
        : undefined;
    const ciclos = ciclosAlumnoParaBusqueda(cicloEscolar);

    let q = dbAlumnos()
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar, alumno_status'
      )
      .eq('alumno_status', 1)
      .limit(limit);

    if (ciclos.length === 1) q = q.eq('alumno_ciclo_escolar', ciclos[0]);
    else if (ciclos.length > 1) q = q.in('alumno_ciclo_escolar', ciclos);

    const { data, error } = await q;
    if (error) throw error;

    const rows = ((data || []) as Record<string, unknown>[])
      .map((r) => mapAlumnoRow(r))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return NextResponse.json({ success: true, data: rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { mapAlumnoRow } from '@/lib/alumnoMappers';
import { getInsforgeAlumnos, alumnosInsforgeConfigured } from '@/lib/insforgeAlumnos';
import { getInsforge } from '@/lib/insforge';

function dbAlumnos() {
  if (alumnosInsforgeConfigured()) return getInsforgeAlumnos().database;
  return getInsforge().database;
}

/** Resuelve alumnos por alumno_id (Winston Servicios). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids = [...new Set(rawIds.map(String).filter(Boolean))];
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const numericIds = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));
    const alumnoPorId = new Map<string, ReturnType<typeof mapAlumnoRow>>();

    if (numericIds.length > 0) {
      const { data, error } = await dbAlumnos()
        .from('alumno')
        .select(
          'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar, alumno_status'
        )
        .in('alumno_id', numericIds);
      if (error) throw error;
      for (const row of (data || []) as Record<string, unknown>[]) {
        const m = mapAlumnoRow(row);
        alumnoPorId.set(String(row.alumno_id), m);
      }
    }

    // Fallback por si algún id no numérico quedó como string exacta
    for (const id of ids) {
      if (alumnoPorId.has(id)) continue;
      const { data, error } = await dbAlumnos()
        .from('alumno')
        .select(
          'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar, alumno_status'
        )
        .eq('alumno_id', id)
        .maybeSingle();
      if (!error && data) {
        alumnoPorId.set(id, mapAlumnoRow(data as Record<string, unknown>));
      }
    }

    return NextResponse.json({ success: true, data: [...alumnoPorId.values()] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

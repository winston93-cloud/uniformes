import type { SupabaseClient } from '@supabase/supabase-js';
import { ciclosAlumnoParaBusqueda, textoBusquedaAlumno } from './alumnoDisplay';
import { mapAlumnoRow, type Alumno } from './alumnoMappers';

function escaparWildcards(valor: string) {
  return valor.replace(/[%_\\]/g, '\\$&');
}

function aplicarFiltroCiclos<T extends { eq: Function; in: Function }>(
  q: T,
  ciclos: number[]
): T {
  if (ciclos.length === 1) return q.eq('alumno_ciclo_escolar', ciclos[0]) as T;
  if (ciclos.length > 1) return q.in('alumno_ciclo_escolar', ciclos) as T;
  return q;
}

/** Búsqueda en `public.alumno` (sin ilike sobre alumno_ref integer — rompe PostgREST). */
export async function buscarAlumnosSupabase(
  supabase: SupabaseClient,
  query: string,
  cicloEscolar?: number
): Promise<Alumno[]> {
  const trimmed = query.trim();
  const consulta = escaparWildcards(trimmed);
  if (!consulta) return [];

  const qLower = trimmed.toLowerCase();
  const ciclos = ciclosAlumnoParaBusqueda(cicloEscolar);
  const porId = new Map<string, Record<string, unknown>>();

  const agregar = (rows: Record<string, unknown>[] | null) => {
    for (const r of rows || []) {
      const id = String(r.alumno_id ?? r.alumnoId ?? '');
      if (id) porId.set(id, r);
    }
  };

  // Por nombre / apellidos (solo columnas texto)
  let qNombre = supabase
    .from('alumno')
    .select('*')
    .or(
      `alumno_nombre.ilike.%${consulta}%,alumno_app.ilike.%${consulta}%,alumno_apm.ilike.%${consulta}%`
    )
    .limit(150);
  qNombre = aplicarFiltroCiclos(qNombre, ciclos);
  const { data: porNombre, error: errNombre } = await qNombre;
  if (errNombre) throw errNombre;
  agregar(porNombre as Record<string, unknown>[]);

  // Por referencia numérica (alumno_ref es integer)
  if (/^\d+$/.test(trimmed)) {
    let qRef = supabase.from('alumno').select('*').eq('alumno_ref', Number(trimmed)).limit(50);
    qRef = aplicarFiltroCiclos(qRef, ciclos);
    const { data: porRef, error: errRef } = await qRef;
    if (errRef) throw errRef;
    agregar(porRef as Record<string, unknown>[]);
  }

  let rawRows = [...porId.values()];

  rawRows = rawRows.filter((r) => {
    const st = r.alumno_status ?? r.alumnoStatus;
    if (st === undefined || st === null) return true;
    return Number(st) === 1;
  });

  const tokens = qLower.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    rawRows = rawRows.filter((r) => {
      const blob = textoBusquedaAlumno(r as Parameters<typeof textoBusquedaAlumno>[0]);
      return tokens.every((t) => blob.includes(t));
    });
  }

  return rawRows.slice(0, 100).map((r) => mapAlumnoRow(r));
}

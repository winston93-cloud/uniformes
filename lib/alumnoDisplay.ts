/** Nombre para mostrar / buscar a partir del esquema actual de `public.alumno`. */
export function nombreCompletoAlumno(row: {
  alumno_nombre_completo?: string | null;
  alumno_nombre?: string | null;
  alumno_app?: string | null;
  alumno_apm?: string | null;
}): string {
  const precomp = row.alumno_nombre_completo?.trim();
  if (precomp) return precomp;
  return [row.alumno_nombre, row.alumno_app, row.alumno_apm]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto buscable: nombre completo + ref + partes sueltas. */
export function textoBusquedaAlumno(row: {
  alumno_ref?: string | number | null;
  alumno_nombre_completo?: string | null;
  alumno_nombre?: string | null;
  alumno_app?: string | null;
  alumno_apm?: string | null;
}): string {
  const partes = [
    nombreCompletoAlumno(row),
    row.alumno_ref != null ? String(row.alumno_ref) : '',
    row.alumno_nombre,
    row.alumno_app,
    row.alumno_apm,
  ];
  return partes
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Ciclos escolares activos para búsqueda de alumnos (Winston Servicios). */
export const CICLOS_ALUMNO_SYNC = [22, 23] as const;

export function ciclosAlumnoParaBusqueda(cicloSesion?: number): number[] {
  if (cicloSesion === undefined) return [...CICLOS_ALUMNO_SYNC];
  const set = new Set<number>([cicloSesion, ...CICLOS_ALUMNO_SYNC]);
  return [...set];
}

import type { Alumno } from '@/lib/alumnoMappers';

/** Carga alumnos por id vía API (Winston Servicios en servidor). */
export async function fetchAlumnosByIds(ids: string[]): Promise<Map<string, Alumno>> {
  const uniq = [...new Set(ids.map(String).filter(Boolean))];
  const map = new Map<string, Alumno>();
  if (uniq.length === 0) return map;

  const res = await fetch('/api/alumno/by-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: uniq }),
  });
  const json = await res.json().catch(() => null);
  if (!json?.success) {
    console.error('fetchAlumnosByIds:', json?.error || res.status);
    return map;
  }
  for (const a of (json.data || []) as Alumno[]) {
    if (a?.id) map.set(String(a.id), a);
  }
  return map;
}

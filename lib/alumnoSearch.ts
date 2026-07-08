import { ciclosAlumnoParaBusqueda } from './alumnoDisplay';
import { mapAlumnoRow, type Alumno } from './alumnoMappers';
import { getInsforge } from '@/lib/insforge';
import { alumnosInsforgeConfigured, getInsforgeAlumnos } from '@/lib/insforgeAlumnos';

type AlumnoDb = ReturnType<typeof getInsforge>['database'];

const CANDIDATOS_POR_TERMINO = 80;
const RESULTADOS_MAX = 20;
const COLUMNAS =
  'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar, alumno_status';

function escaparWildcards(valor: string) {
  return valor.replace(/[%_\\]/g, '\\$&');
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensDeConsulta(consulta: string): string[] {
  return normalizar(consulta)
    .split(' ')
    .filter((t) => t.length >= 1);
}

function aplicarFiltroCiclos<T extends { eq: Function; in: Function }>(q: T, ciclos: number[]): T {
  if (ciclos.length === 1) return q.eq('alumno_ciclo_escolar', ciclos[0]) as T;
  if (ciclos.length > 1) return q.in('alumno_ciclo_escolar', ciclos) as T;
  return q;
}

function blobBusqueda(row: Record<string, unknown>): string {
  return normalizar(
    [
      row.alumno_nombre,
      row.alumno_app,
      row.alumno_apm,
      row.alumno_ref != null ? String(row.alumno_ref) : '',
    ]
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter(Boolean)
      .join(' ')
  );
}

function puntuar(row: Record<string, unknown>, consulta: string): number {
  const tokens = tokensDeConsulta(consulta);
  const blob = blobBusqueda(row);
  const qCompleta = normalizar(consulta);
  let pts = 0;

  if (!blob) return 0;
  if (blob === qCompleta) pts += 1000;
  else if (blob.startsWith(qCompleta)) pts += 500;
  else if (blob.includes(qCompleta)) pts += 200;

  if (tokens.length === 0) return pts;

  let todos = true;
  for (const t of tokens) {
    if (blob.includes(t)) pts += 80;
    else todos = false;
  }
  if (todos && tokens.length >= 2) pts += 150;
  else if (!todos) return 0;

  const ref = String(row.alumno_ref ?? '').trim();
  if (/^\d+$/.test(consulta.trim()) && ref === consulta.trim()) pts += 1200;

  return pts;
}

async function consultarPorTermino(
  db: AlumnoDb,
  termino: string,
  ciclos: number[]
): Promise<Record<string, unknown>[]> {
  const esc = escaparWildcards(termino);
  const orParts = [
    `alumno_nombre.ilike.%${esc}%`,
    `alumno_app.ilike.%${esc}%`,
    `alumno_apm.ilike.%${esc}%`,
  ];
  if (/^\d+$/.test(termino.trim())) {
    orParts.push(`alumno_ref.eq.${termino.trim()}`);
  }

  let q = db.from('alumno').select(COLUMNAS).or(orParts.join(',')).limit(CANDIDATOS_POR_TERMINO);
  q = aplicarFiltroCiclos(q, ciclos);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

function dbAlumnosParaBusqueda(): AlumnoDb {
  // Preferir Winston Servicios; si faltan env en local/Vercel, caer a Uniformes.
  if (alumnosInsforgeConfigured()) {
    return getInsforgeAlumnos().database;
  }
  return getInsforge().database;
}

/**
 * Búsqueda en `alumno` por concatenación nombre + apellidos (orden indiferente).
 * Fuente preferida: InsForge Winston Servicios.
 */
export async function buscarAlumnosEnDb(
  db: AlumnoDb | null,
  query: string,
  cicloEscolar?: number
): Promise<Alumno[]> {
  const limpia = query.replace(/\s+/g, ' ').trim();
  if (limpia.length < 2) return [];

  const client = db ?? dbAlumnosParaBusqueda();
  const ciclos = ciclosAlumnoParaBusqueda(cicloEscolar);
  const tokens = tokensDeConsulta(limpia);

  // Cada token se busca por su lado (herandez y ostos), no la frase completa.
  // Así "hernandez ostos" y "ostos hernandez" encuentran al mismo alumno.
  const terminos = new Set<string>();
  for (const t of tokens) {
    if (t.length >= 2) terminos.add(t);
  }
  // Si el usuario escribió una sola palabra corta/frase, también probar la limpia
  if (tokens.length === 1) terminos.add(limpia);

  const porId = new Map<string, Record<string, unknown>>();
  const lotes = await Promise.all(
    [...terminos].map((termino) => consultarPorTermino(client, termino, ciclos))
  );
  for (const filas of lotes) {
    for (const r of filas) {
      const id = String(r.alumno_id ?? r.alumnoId ?? '');
      if (id) porId.set(id, r);
    }
  }

  let rawRows = [...porId.values()].filter((r) => {
    const st = r.alumno_status ?? r.alumnoStatus;
    if (st === undefined || st === null) return true;
    return Number(st) === 1;
  });

  const rankeados = rawRows
    .map((r) => ({ r, pts: puntuar(r, limpia) }))
    .filter((x) => x.pts > 0)
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const na = blobBusqueda(a.r);
      const nb = blobBusqueda(b.r);
      return na.localeCompare(nb, 'es');
    })
    .slice(0, RESULTADOS_MAX)
    .map((x) => mapAlumnoRow(x.r));

  return rankeados;
}

/** @deprecated Usar buscarAlumnosEnDb */
export const buscarAlumnosSupabase = buscarAlumnosEnDb;

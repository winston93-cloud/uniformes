'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ciclosAlumnoParaBusqueda,
  nombreCompletoAlumno,
  textoBusquedaAlumno,
} from '../alumnoDisplay';
import { getSupabaseErrorMessage, supabase } from '../supabase';

export interface AlumnoFromDB {
  alumno_id: number;
  alumno_ref: string;
  alumno_app: string | null;
  alumno_apm: string | null;
  alumno_nombre: string | null;
  alumno_nivel: number | null;
  alumno_grado: number | null;
  alumno_grupo: number | null;
  alumno_ciclo_escolar: number | null;
  alumno_nombre_completo: string | null;
  alumno_status: number | null;
}

export interface Alumno {
  id: string;
  nombre: string;
  referencia: string;
  nivel: string | null;
  grado: string | null;
  grupo: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

const numeroANivel = (num: number | null): string | null => {
  if (num === null) return null;
  switch (num) {
    case 1:
      return 'Maternal';
    case 2:
      return 'Kinder';
    case 3:
      return 'Primaria';
    case 4:
      return 'Secundaria';
    default:
      return 'Otro';
  }
};

const numeroAGrupo = (num: number | null): string | null => {
  if (num === null) return null;
  if (num >= 1 && num <= 26) {
    return String.fromCharCode(64 + num);
  }
  return num.toString();
};

export const mapAlumnoFromDB = (db: AlumnoFromDB): Alumno => {
  const nombreCompleto = nombreCompletoAlumno(db) || 'Sin nombre';

  return {
    id: db.alumno_id.toString(),
    nombre: nombreCompleto,
    referencia: db.alumno_ref,
    nivel: numeroANivel(db.alumno_nivel),
    grado: db.alumno_grado ? `${db.alumno_grado}°` : null,
    grupo: numeroAGrupo(db.alumno_grupo),
    telefono: null,
    email: null,
    activo: db.alumno_status === 1,
  };
};

/** Esquema legado `public.alumno` (alumno_id, alumno_*). Sin columna `activo`: usamos alumno_status. */
function coerceLegacyRow(raw: Record<string, unknown>): AlumnoFromDB {
  const idRaw = raw.alumno_id ?? raw.alumnoId;
  return {
    alumno_id: typeof idRaw === 'number' ? idRaw : Number(idRaw ?? 0),
    alumno_ref: String(raw.alumno_ref ?? raw.alumnoRef ?? ''),
    alumno_app: raw.alumno_app != null ? String(raw.alumno_app) : null,
    alumno_apm: raw.alumno_apm != null ? String(raw.alumno_apm) : null,
    alumno_nombre: raw.alumno_nombre != null ? String(raw.alumno_nombre) : null,
    alumno_nivel:
      raw.alumno_nivel != null ? Number(raw.alumno_nivel) : raw.alumnoNivel != null ? Number(raw.alumnoNivel) : null,
    alumno_grado:
      raw.alumno_grado != null ? Number(raw.alumno_grado) : raw.alumnoGrado != null ? Number(raw.alumnoGrado) : null,
    alumno_grupo:
      raw.alumno_grupo != null ? Number(raw.alumno_grupo) : raw.alumnoGrupo != null ? Number(raw.alumnoGrupo) : null,
    alumno_ciclo_escolar:
      raw.alumno_ciclo_escolar != null
        ? Number(raw.alumno_ciclo_escolar)
        : raw.alumnoCicloEscolar != null
          ? Number(raw.alumnoCicloEscolar)
          : raw.ciclo_escolar != null
            ? Number(raw.ciclo_escolar)
            : null,
    alumno_nombre_completo:
      raw.alumno_nombre_completo != null ? String(raw.alumno_nombre_completo) : null,
    alumno_status:
      raw.alumno_status != null ? Number(raw.alumno_status) : raw.alumnoStatus != null ? Number(raw.alumnoStatus) : null,
  };
}

/** Variante UUID/nombre corto (si existiera otro esquema). */
export function mapAlumnoPublic(row: Record<string, unknown>): Alumno {
  return {
    id: String(row.id ?? ''),
    nombre: String(row.nombre ?? 'Sin nombre'),
    referencia: String(row.referencia ?? ''),
    nivel: row.nivel != null ? String(row.nivel) : null,
    grado: row.grado != null ? String(row.grado) : null,
    grupo: row.grupo != null ? String(row.grupo) : null,
    telefono: row.telefono != null ? String(row.telefono) : null,
    email: row.email != null ? String(row.email) : null,
    activo: row.activo !== false,
  };
}

export function mapAlumnoRow(raw: Record<string, unknown>): Alumno {
  if (raw.alumno_id != null || raw.alumnoId != null) {
    return mapAlumnoFromDB(coerceLegacyRow(raw));
  }
  return mapAlumnoPublic(raw);
}

function escaparWildcards(valor: string) {
  return valor.replace(/[%_\\]/g, '\\$&');
}

export function useAlumnos(cicloEscolar?: number) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlumnos = async () => {
    try {
      setLoading(true);
      /** Activo = alumno_status 1 (no existe columna `activo`). */
      const { data, error: err } = await supabase
        .from('alumno')
        .select('*')
        .eq('alumno_status', 1)
        .limit(5000);

      if (err) throw err;

      let rawRows = data || [];
      const ciclosPermitidos = new Set(ciclosAlumnoParaBusqueda(cicloEscolar));
      rawRows = rawRows.filter((raw) => {
        const r = raw as Record<string, unknown>;
        const c = r.alumno_ciclo_escolar ?? r.ciclo_escolar ?? r.cicloEscolar;
        if (c === undefined || c === null) return true;
        return ciclosPermitidos.has(Number(c));
      });

      const rows = rawRows.map((r) => mapAlumnoRow(r as Record<string, unknown>));
      rows.sort((a, b) => a.referencia.localeCompare(b.referencia, 'es'));
      setAlumnos(rows);
      setError(null);
    } catch (err: unknown) {
      setError(getSupabaseErrorMessage(err));
      console.error('Error fetching alumnos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlumnos();
  }, [cicloEscolar]);

  const searchAlumnos = useCallback(
    async (query: string) => {
      const consulta = escaparWildcards(query.trim());
      if (!consulta) return [];

      const qLower = query.trim().toLowerCase();
      const ciclos = ciclosAlumnoParaBusqueda(cicloEscolar);

      // Sin `alumno_nombre_completo` en el esquema nuevo: buscar por ref y por partes del nombre.
      let q = supabase
        .from('alumno')
        .select('*')
        .or(
          `alumno_ref.ilike.%${consulta}%,alumno_nombre.ilike.%${consulta}%,alumno_app.ilike.%${consulta}%,alumno_apm.ilike.%${consulta}%`
        )
        .limit(150);

      if (ciclos.length === 1) {
        q = q.eq('alumno_ciclo_escolar', ciclos[0]);
      } else if (ciclos.length > 1) {
        q = q.in('alumno_ciclo_escolar', ciclos);
      }

      const { data, error } = await q;
      if (error) throw error;

      let rawRows = (data || []) as Record<string, unknown>[];

      // Activo: alumno_status === 1 (si viene otro valor, no mostrar)
      rawRows = rawRows.filter((r) => {
        const st = r.alumno_status ?? r.alumnoStatus;
        if (st === undefined || st === null) return true;
        return Number(st) === 1;
      });

      // Coincidencia por nombre completo armado (ej. "jana paola aguilar")
      const tokens = qLower.split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        rawRows = rawRows.filter((r) => {
          const blob = textoBusquedaAlumno(r as Parameters<typeof textoBusquedaAlumno>[0]);
          return tokens.every((t) => blob.includes(t));
        });
      }

      return rawRows.slice(0, 100).map((r) => mapAlumnoRow(r));
    },
    [cicloEscolar]
  );

  return {
    alumnos,
    loading,
    error,
    refetch: fetchAlumnos,
    searchAlumnos,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

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
  const nombreCompleto =
    db.alumno_nombre_completo ||
    [db.alumno_nombre, db.alumno_app, db.alumno_apm].filter(Boolean).join(' ') ||
    'Sin nombre';

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

/** Tabla en Supabase: `public.alumno` (singular). */
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
      const { data, error: err } = await supabase.from('alumno').select('*').eq('activo', true).limit(5000);

      if (err) throw err;

      let rawRows = data || [];
      if (cicloEscolar !== undefined) {
        rawRows = rawRows.filter((raw) => {
          const r = raw as Record<string, unknown>;
          const c = r.ciclo_escolar ?? r.cicloEscolar ?? r.alumno_ciclo_escolar;
          if (c === undefined || c === null) return true;
          return Number(c) === cicloEscolar;
        });
      }

      const rows = rawRows.map((r) => mapAlumnoPublic(r as Record<string, unknown>));
      rows.sort((a, b) => a.referencia.localeCompare(b.referencia, 'es'));
      setAlumnos(rows);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
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

      const { data, error } = await supabase
        .from('alumno')
        .select('*')
        .eq('activo', true)
        .or(`referencia.ilike.%${consulta}%,nombre.ilike.%${consulta}%`)
        .limit(100);

      if (error) throw error;

      let rawRows = data || [];
      if (cicloEscolar !== undefined) {
        rawRows = rawRows.filter((raw) => {
          const r = raw as Record<string, unknown>;
          const c = r.ciclo_escolar ?? r.cicloEscolar;
          if (c === undefined || c === null) return true;
          return Number(c) === cicloEscolar;
        });
      }

      return rawRows.map((r) => mapAlumnoPublic(r as Record<string, unknown>));
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ciclosAlumnoParaBusqueda } from '../alumnoDisplay';
import { mapAlumnoRow, type Alumno, type AlumnoFromDB } from '../alumnoMappers';
import { getSupabaseErrorMessage, supabase } from '../supabase';

export type { Alumno, AlumnoFromDB } from '../alumnoMappers';
export { mapAlumnoFromDB, mapAlumnoPublic, mapAlumnoRow } from '../alumnoMappers';

export function useAlumnos(cicloEscolar?: number) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlumnos = async () => {
    try {
      setLoading(true);
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
      const trimmed = query.trim();
      if (trimmed.length < 2) return [];

      const params = new URLSearchParams({ q: trimmed });
      if (cicloEscolar !== undefined) params.set('ciclo', String(cicloEscolar));

      const res = await fetch(`/api/alumno/search?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!json?.success) {
        throw new Error(String(json?.error || `Búsqueda de alumnos falló (HTTP ${res.status})`));
      }
      return (json.data || []) as Alumno[];
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

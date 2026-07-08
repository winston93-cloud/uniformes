'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Alumno, AlumnoFromDB } from '../alumnoMappers';
import { getSupabaseErrorMessage } from '../supabase';

export type { Alumno, AlumnoFromDB } from '../alumnoMappers';
export { mapAlumnoFromDB, mapAlumnoPublic, mapAlumnoRow } from '../alumnoMappers';

/**
 * Alumnos desde InsForge Winston Servicios (vía API server).
 * Externos siguen en proyecto Uniformes.
 */
export function useAlumnos(cicloEscolar?: number, opts?: { lazy?: boolean }) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(!(opts?.lazy));
  const [error, setError] = useState<string | null>(null);

  const fetchAlumnos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500' });
      if (cicloEscolar !== undefined) params.set('ciclo', String(cicloEscolar));
      const res = await fetch(`/api/alumno/list?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!json?.success) {
        throw new Error(String(json?.error || `Lista de alumnos falló (HTTP ${res.status})`));
      }
      setAlumnos((json.data || []) as Alumno[]);
      setError(null);
    } catch (err: unknown) {
      setError(getSupabaseErrorMessage(err));
      console.error('Error fetching alumnos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opts?.lazy) {
      setLoading(false);
      return;
    }
    fetchAlumnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloEscolar, opts?.lazy]);

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

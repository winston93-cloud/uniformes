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
  alumno_nombre_completo: string | null;
  alumno_status: number | null;
}

export interface Alumno {
  id: string;
  nombre: string;
  referencia: string;
  grado: string | null;
  grupo: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

// Convertir número a letra de grupo
const numeroAGrupo = (num: number | null): string | null => {
  if (num === null) return null;
  if (num >= 1 && num <= 26) {
    return String.fromCharCode(64 + num); // A-Z
  }
  return num.toString();
};

// Convertir letra a número de grupo
const grupoANumero = (letra: string | null): number | null => {
  if (!letra) return null;
  if (letra.length === 1 && letra.match(/[A-Z]/i)) {
    return letra.toUpperCase().charCodeAt(0) - 64;
  }
  const num = parseInt(letra);
  return isNaN(num) ? null : num;
};

// Mapear de DB a Interfaz
export const mapAlumnoFromDB = (db: AlumnoFromDB): Alumno => {
  const nombreCompleto = db.alumno_nombre_completo || 
    [db.alumno_nombre, db.alumno_app, db.alumno_apm]
      .filter(Boolean)
      .join(' ') || 'Sin nombre';
  
  return {
    id: db.alumno_id.toString(),
    nombre: nombreCompleto,
    referencia: db.alumno_ref,
    grado: db.alumno_grado ? `${db.alumno_grado}°` : null,
    grupo: numeroAGrupo(db.alumno_grupo),
    telefono: null, // No existe en la tabla
    email: null, // No existe en la tabla
    activo: db.alumno_status !== null && db.alumno_status !== 0,
  };
};

export function useAlumnos() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlumnos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('alumno')
        .select('*')
        .order('alumno_ref', { ascending: true })
        .limit(1000); // Limitar para performance

      if (error) throw error;
      setAlumnos((data || []).map(mapAlumnoFromDB));
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching alumnos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlumnos();
  }, []);

  const escaparWildcards = (valor: string) => {
    return valor.replace(/[%_\\]/g, '\\$&');
  };

  const searchAlumnos = useCallback(async (query: string) => {
    try {
      const consulta = escaparWildcards(query.trim());
      if (!consulta) return [];

      const { data, error } = await supabase
        .from('alumno')
        .select('*')
        .or(`alumno_ref.ilike.%${consulta}%,alumno_nombre.ilike.%${consulta}%,alumno_app.ilike.%${consulta}%,alumno_apm.ilike.%${consulta}%`)
        .limit(100);

      if (error) throw error;
      
      return (data || []).map(mapAlumnoFromDB);
    } catch (err: any) {
      throw err; // Propagar error para que el componente lo maneje
    }
  }, []);

  return {
    alumnos,
    loading,
    error,
    refetch: fetchAlumnos,
    searchAlumnos,
  };
}


'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface CicloEscolar {
  id: number;
  valor: number;
  nombre: string;
  anio_inicio: number;
  anio_fin: number;
  activo: boolean;
  es_actual: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useCiclosEscolares() {
  const [ciclos, setCiclos] = useState<CicloEscolar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCiclos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ciclos_escolares')
        .select('*')
        .order('valor', { ascending: false });

      if (error) throw error;
      setCiclos(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching ciclos escolares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCiclos();
  }, []);

  const crearCiclo = async (ciclo: Omit<CicloEscolar, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('ciclos_escolares')
        .insert(ciclo)
        .select()
        .single();

      if (error) throw error;
      await fetchCiclos();
      return { success: true, data };
    } catch (err: any) {
      console.error('Error creando ciclo escolar:', err);
      return { success: false, error: err.message };
    }
  };

  const actualizarCiclo = async (id: number, cambios: Partial<CicloEscolar>) => {
    try {
      const { data, error } = await supabase
        .from('ciclos_escolares')
        .update(cambios)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchCiclos();
      return { success: true, data };
    } catch (err: any) {
      console.error('Error actualizando ciclo escolar:', err);
      return { success: false, error: err.message };
    }
  };

  const eliminarCiclo = async (id: number) => {
    try {
      const { error } = await supabase
        .from('ciclos_escolares')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchCiclos();
      return { success: true };
    } catch (err: any) {
      console.error('Error eliminando ciclo escolar:', err);
      return { success: false, error: err.message };
    }
  };

  const marcarComoActual = async (id: number) => {
    try {
      // El trigger se encarga de desactivar los demás
      const { data, error } = await supabase
        .from('ciclos_escolares')
        .update({ es_actual: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchCiclos();
      return { success: true, data };
    } catch (err: any) {
      console.error('Error marcando ciclo como actual:', err);
      return { success: false, error: err.message };
    }
  };

  const getCicloActual = () => {
    return ciclos.find(c => c.es_actual);
  };

  const getCiclosActivos = () => {
    return ciclos.filter(c => c.activo);
  };

  return {
    ciclos,
    loading,
    error,
    fetchCiclos,
    crearCiclo,
    actualizarCiclo,
    eliminarCiclo,
    marcarComoActual,
    getCicloActual,
    getCiclosActivos,
  };
}

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { UbicacionAlmacenamiento } from '../types';

export function useUbicacionesAlmacenamiento() {
  const [ubicaciones, setUbicaciones] = useState<UbicacionAlmacenamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUbicaciones = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ubicaciones_almacenamiento')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setUbicaciones(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUbicaciones();

    const subscription = supabase
      .channel('ubicaciones_almacenamiento_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ubicaciones_almacenamiento' 
      }, () => {
        fetchUbicaciones();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const createUbicacion = async (ubicacionData: Omit<UbicacionAlmacenamiento, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: existing } = await supabase
        .from('ubicaciones_almacenamiento')
        .select('id')
        .ilike('nombre', ubicacionData.nombre)
        .maybeSingle();

      if (existing) {
        return { data: null, error: 'Ya existe una ubicación con ese nombre' };
      }

      const { data, error } = await supabase
        .from('ubicaciones_almacenamiento')
        .insert([ubicacionData])
        .select()
        .single();

      if (error) throw error;
      await fetchUbicaciones();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updateUbicacion = async (id: string, ubicacionData: Partial<UbicacionAlmacenamiento>) => {
    try {
      if (ubicacionData.nombre) {
        const { data: existing } = await supabase
          .from('ubicaciones_almacenamiento')
          .select('id')
          .ilike('nombre', ubicacionData.nombre)
          .neq('id', id)
          .maybeSingle();

        if (existing) {
          return { data: null, error: 'Ya existe una ubicación con ese nombre' };
        }
      }

      const { data, error } = await supabase
        .from('ubicaciones_almacenamiento')
        .update(ubicacionData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchUbicaciones();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deleteUbicacion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ubicaciones_almacenamiento')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchUbicaciones();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    ubicaciones,
    loading,
    error,
    createUbicacion,
    updateUbicacion,
    deleteUbicacion,
    refetch: fetchUbicaciones,
  };
}

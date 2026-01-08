import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Presentacion } from '../types';

export function usePresentaciones() {
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresentaciones = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('presentaciones')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setPresentaciones(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresentaciones();

    // Suscripción en tiempo real
    const subscription = supabase
      .channel('presentaciones_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'presentaciones' 
      }, () => {
        fetchPresentaciones();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const createPresentacion = async (presentacionData: Omit<Presentacion, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('presentaciones')
        .insert([presentacionData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updatePresentacion = async (id: string, presentacionData: Partial<Presentacion>) => {
    try {
      const { data, error } = await supabase
        .from('presentaciones')
        .update(presentacionData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deletePresentacion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('presentaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    presentaciones,
    loading,
    error,
    createPresentacion,
    updatePresentacion,
    deletePresentacion,
    refetch: fetchPresentaciones,
  };
}

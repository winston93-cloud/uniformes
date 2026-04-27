'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Talla } from '../types';

export function useTallas() {
  const [tallas, setTallas] = useState<Talla[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTallas = async () => {
    try {
      setLoading(true);
      const rpc = await supabase.rpc('obtener_tallas_ordenadas');
      if (!rpc.error && rpc.data != null && (rpc.data as unknown[]).length > 0) {
        setTallas((rpc.data || []) as Talla[]);
        setError(null);
        return;
      }
      let fb = await supabase.from('tallas').select('*').order('orden', { ascending: true });
      if (fb.error) {
        fb = await supabase.from('tallas').select('*');
      }
      if (fb.error) throw fb.error;
      const rows = [...(fb.data || [])];
      rows.sort((a, b) =>
        String((a as { nombre?: string }).nombre ?? '').localeCompare(
          String((b as { nombre?: string }).nombre ?? ''),
          'es'
        )
      );
      setTallas(rows as Talla[]);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching tallas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTallas();
  }, []);

  const createTalla = async (talla: Omit<Talla, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tallas')
        .insert([talla])
        .select()
        .single();

      if (error) throw error;
      await fetchTallas();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updateTalla = async (id: string, updates: Partial<Talla>) => {
    try {
      const { data, error } = await supabase
        .from('tallas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchTallas();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deleteTalla = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tallas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchTallas();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    tallas,
    loading,
    error,
    createTalla,
    updateTalla,
    deleteTalla,
    refetch: fetchTallas,
  };
}


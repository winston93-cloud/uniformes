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
      const { data, error } = await supabase
        .from('tallas')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setTallas(data || []);
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


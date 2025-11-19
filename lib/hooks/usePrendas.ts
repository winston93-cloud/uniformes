'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Prenda } from '../types';

export function usePrendas() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrendas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prendas')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setPrendas(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching prendas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrendas();
  }, []);

  const createPrenda = async (prenda: Omit<Prenda, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('prendas')
        .insert([prenda])
        .select()
        .single();

      if (error) throw error;
      await fetchPrendas();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updatePrenda = async (id: string, updates: Partial<Prenda>) => {
    try {
      const { data, error } = await supabase
        .from('prendas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchPrendas();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deletePrenda = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prendas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchPrendas();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    prendas,
    loading,
    error,
    createPrenda,
    updatePrenda,
    deletePrenda,
    refetch: fetchPrendas,
  };
}


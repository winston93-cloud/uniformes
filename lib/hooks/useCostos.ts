'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Costo } from '../types';

export function useCostos() {
  const [costos, setCostos] = useState<Costo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('costos')
        .select(`
          *,
          talla:tallas(*),
          prenda:prendas(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCostos(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching costos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostos();
  }, []);

  const createCosto = async (costo: Omit<Costo, 'id' | 'created_at' | 'updated_at' | 'talla' | 'prenda'>) => {
    try {
      const { data, error } = await supabase
        .from('costos')
        .insert([costo])
        .select(`
          *,
          talla:tallas(*),
          prenda:prendas(*)
        `)
        .single();

      if (error) throw error;
      await fetchCostos();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updateCosto = async (id: string, updates: Partial<Costo>) => {
    try {
      const { data, error } = await supabase
        .from('costos')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          talla:tallas(*),
          prenda:prendas(*)
        `)
        .single();

      if (error) throw error;
      await fetchCostos();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  return {
    costos,
    loading,
    error,
    createCosto,
    updateCosto,
    refetch: fetchCostos,
  };
}


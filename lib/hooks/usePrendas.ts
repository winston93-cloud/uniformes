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
        .select(`
          *,
          categoria:categorias_prendas(*)
        `)
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
      // 1. Obtener todos los costos de la prenda
      const { data: costos, error: costosError } = await supabase
        .from('costos')
        .select('id')
        .eq('prenda_id', id);

      if (costosError) throw costosError;

      // 2. Si hay costos, eliminar todos los detalle_pedidos asociados
      if (costos && costos.length > 0) {
        const costosIds = costos.map(c => c.id);
        const { error: detalleError } = await supabase
          .from('detalle_pedidos')
          .delete()
          .in('costo_id', costosIds);

        if (detalleError) throw detalleError;
      }

      // 3. Eliminar los costos de la prenda
      const { error: costosDelError } = await supabase
        .from('costos')
        .delete()
        .eq('prenda_id', id);

      if (costosDelError) throw costosDelError;

      // 4. Finalmente eliminar la prenda
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


'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { CategoriaPrenda, Prenda } from '../types';

/** InsForge a veces no expone FK en schema cache → el embed `categorias_prendas(*)` falla. Unimos por categoria_id en cliente. */
export function usePrendas() {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrendas = async () => {
    try {
      setLoading(true);
      const [preRes, catRes] = await Promise.all([
        supabase.from('prendas').select('*').order('nombre', { ascending: true }),
        supabase.from('categorias_prendas').select('*'),
      ]);
      if (preRes.error) throw preRes.error;
      if (catRes.error) throw catRes.error;

      const catById = new Map<string, CategoriaPrenda>(
        (catRes.data || []).map((c) => [c.id, c as CategoriaPrenda])
      );
      const mapped: Prenda[] = (preRes.data || []).map((row) => {
        const r = row as Prenda;
        const categoria =
          r.categoria_id != null ? catById.get(r.categoria_id) ?? undefined : undefined;
        return { ...r, categoria };
      });
      setPrendas(mapped);
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
      // 1. Eliminar detalle_pedidos por prenda_id (relación directa)
      const { error: detallePrendaError } = await supabase
        .from('detalle_pedidos')
        .delete()
        .eq('prenda_id', id);

      if (detallePrendaError) throw detallePrendaError;

      // 2. Obtener todos los costos de la prenda
      const { data: costos, error: costosError } = await supabase
        .from('costos')
        .select('id')
        .eq('prenda_id', id);

      if (costosError) throw costosError;

      // 3. Si hay costos, eliminar registros relacionados por costo_id
      if (costos && costos.length > 0) {
        const costosIds = costos.map(c => c.id);
        
        // Eliminar detalle_pedidos asociados por costo_id
        const { error: detalleCostoError } = await supabase
          .from('detalle_pedidos')
          .delete()
          .in('costo_id', costosIds);

        if (detalleCostoError) throw detalleCostoError;

        // Eliminar movimientos asociados
        const { error: movimientosError } = await supabase
          .from('movimientos')
          .delete()
          .in('costo_id', costosIds);

        if (movimientosError) throw movimientosError;
      }

      // 4. Eliminar los costos de la prenda
      const { error: costosDelError } = await supabase
        .from('costos')
        .delete()
        .eq('prenda_id', id);

      if (costosDelError) throw costosDelError;

      // 5. Finalmente eliminar la prenda
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


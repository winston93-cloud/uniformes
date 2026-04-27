'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Costo } from '../types';

/** InsForge PostgREST a veces rechaza alias `talla:tallas(*)`; usamos embeds sin alias y mapeamos. */
const COSTOS_EMBED = `*, tallas(*), prendas(*)`;

function normalizeCostoRow(row: Record<string, unknown>): Costo {
  const tr = row.talla ?? row.tallas;
  const pr = row.prenda ?? row.prendas;
  const talla = Array.isArray(tr) ? tr[0] : tr;
  const prenda = Array.isArray(pr) ? pr[0] : pr;
  const { tallas: _t, prendas: _p, ...rest } = row;
  return { ...rest, talla, prenda } as Costo;
}

export function useCostos(sucursal_id?: string) {
  const [costos, setCostos] = useState<Costo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostos = async () => {
    try {
      setLoading(true);
      let query = supabase.from('costos').select(COSTOS_EMBED).order('created_at', { ascending: false });

      // Filtrar por sucursal si se proporciona
      if (sucursal_id) {
        query = query.eq('sucursal_id', sucursal_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCostos((data || []).map((r) => normalizeCostoRow(r as Record<string, unknown>)));
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching costos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostos();
  }, [sucursal_id]);

  const createCosto = async (costo: Omit<Costo, 'id' | 'created_at' | 'updated_at' | 'talla' | 'prenda'>) => {
    try {
      const { data, error } = await supabase.from('costos').insert([costo]).select(COSTOS_EMBED).single();

      if (error) throw error;
      await fetchCostos();
      return { data: data ? normalizeCostoRow(data as Record<string, unknown>) : null, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const createMultipleCostos = async (costos: Omit<Costo, 'id' | 'created_at' | 'updated_at' | 'talla' | 'prenda'>[]) => {
    try {
      const { data, error } = await supabase
        .from('costos')
        .insert(costos)
        .select(COSTOS_EMBED);

      if (error) throw error;
      await fetchCostos();
      return {
        data: (data || []).map((r) => normalizeCostoRow(r as Record<string, unknown>)),
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deleteCosto = async (id: string) => {
    try {
      const { error } = await supabase
        .from('costos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchCostos();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const getCostosByPrenda = async (prenda_id: string) => {
    try {
      const { data, error } = await supabase.from('costos').select(COSTOS_EMBED).eq('prenda_id', prenda_id);

      if (error) throw error;
      return {
        data: (data || []).map((r) => normalizeCostoRow(r as Record<string, unknown>)),
        error: null,
      };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  };

  const updateCosto = async (id: string, updates: Partial<Costo>) => {
    try {
      const { data, error } = await supabase
        .from('costos')
        .update(updates)
        .eq('id', id)
        .select(COSTOS_EMBED)
        .single();

      if (error) throw error;
      await fetchCostos();
      return { data: data ? normalizeCostoRow(data as Record<string, unknown>) : null, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  return {
    costos,
    loading,
    error,
    createCosto,
    createMultipleCostos,
    updateCosto,
    deleteCosto,
    getCostosByPrenda,
    refetch: fetchCostos,
  };
}


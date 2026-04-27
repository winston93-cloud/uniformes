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

/** Sin FK en schema cache los embeds fallan: leemos `costos` plano y acoplamos tallas/prendas en cliente. */
async function enrichCostosFromPlainRows(rows: Record<string, unknown>[]): Promise<Costo[]> {
  if (!rows.length) return [];
  const tallaIds = [...new Set(rows.map((r) => r.talla_id).filter(Boolean))] as string[];
  const prendaIds = [...new Set(rows.map((r) => r.prenda_id).filter(Boolean))] as string[];
  const [tRes, pRes] = await Promise.all([
    tallaIds.length > 0 ? supabase.from('tallas').select('*').in('id', tallaIds) : Promise.resolve({ data: [] as unknown[] }),
    prendaIds.length > 0 ? supabase.from('prendas').select('*').in('id', prendaIds) : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const tallaMap = new Map((tRes.data || []).map((t) => [(t as { id: string }).id, t]));
  const prendaMap = new Map((pRes.data || []).map((p) => [(p as { id: string }).id, p]));
  return rows.map((row) => {
    const tid = row.talla_id as string | undefined;
    const pid = row.prenda_id as string | undefined;
    const enriched: Record<string, unknown> = { ...row };
    if (tid && tallaMap.has(tid)) enriched.tallas = tallaMap.get(tid);
    if (pid && prendaMap.has(pid)) enriched.prendas = prendaMap.get(pid);
    return normalizeCostoRow(enriched);
  });
}

export function useCostos(sucursal_id?: string) {
  const [costos, setCostos] = useState<Costo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostos = async () => {
    try {
      setLoading(true);
      let query = supabase.from('costos').select(COSTOS_EMBED).order('created_at', { ascending: false });

      if (sucursal_id) {
        query = query.eq('sucursal_id', sucursal_id);
      }

      let { data, error } = await query;

      if (error) {
        let q2 = supabase.from('costos').select('*').order('created_at', { ascending: false });
        if (sucursal_id) q2 = q2.eq('sucursal_id', sucursal_id);
        const fallback = await q2;
        if (fallback.error) throw fallback.error;
        setCostos(await enrichCostosFromPlainRows((fallback.data || []) as Record<string, unknown>[]));
        setError(null);
        return;
      }

      setCostos((data || []).map((r) => normalizeCostoRow(r as Record<string, unknown>)));
      setError(null);
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
      const { data, error } = await supabase.from('costos').insert([costo]).select('*').single();

      if (error) throw error;
      const [enriched] = await enrichCostosFromPlainRows([(data || {}) as Record<string, unknown>]);
      await fetchCostos();
      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const createMultipleCostos = async (costos: Omit<Costo, 'id' | 'created_at' | 'updated_at' | 'talla' | 'prenda'>[]) => {
    try {
      const { data, error } = await supabase.from('costos').insert(costos).select('*');

      if (error) throw error;
      const enriched = await enrichCostosFromPlainRows((data || []) as Record<string, unknown>[]);
      await fetchCostos();
      return { data: enriched, error: null };
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

  /** Solo columnas de `costos`: InsForge suele no tener FK costos↔tallas/prepar en cache para embeds. */
  const getCostosByPrenda = async (prenda_id: string) => {
    try {
      const { data, error } = await supabase.from('costos').select('*').eq('prenda_id', prenda_id);

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
      const payload = { ...updates };
      delete (payload as Partial<Costo & { talla?: unknown; prenda?: unknown }>).talla;
      delete (payload as Partial<Costo & { talla?: unknown; prenda?: unknown }>).prenda;

      const { data, error } = await supabase.from('costos').update(payload).eq('id', id).select('*').single();

      if (error) throw error;
      const [enriched] = await enrichCostosFromPlainRows([(data || {}) as Record<string, unknown>]);
      await fetchCostos();
      return { data: enriched, error: null };
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


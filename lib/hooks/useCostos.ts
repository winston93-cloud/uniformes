'use client';

import { useState, useEffect } from 'react';
import { getSupabaseErrorMessage } from '../supabase';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { fetchCostosRowsByPrenda, normalizarCamposCostoApi } from '@/lib/costoQueries';
import { filtrarFilasPorSucursalSiHayColumna } from '@/lib/sucursalCliente';
import type { Costo } from '../types';

function readCol(r: Record<string, unknown>, snake: string, camel: string): string | null {
  const v = r[snake] ?? r[camel];
  if (v == null || v === '') return null;
  return String(v);
}

function normIdKey(id: string): string {
  return id.trim().toLowerCase();
}

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
  const tallaIds = [
    ...new Set(rows.map((r) => readCol(r, 'talla_id', 'tallaId')).filter(Boolean)),
  ] as string[];
  const prendaIds = [
    ...new Set(rows.map((r) => readCol(r, 'prenda_id', 'prendaId')).filter(Boolean)),
  ] as string[];
  const [tRes, pRes] = await Promise.all([
    tallaIds.length > 0 ? insforgeDb().from('tallas').select('*').in('id', tallaIds) : Promise.resolve({ data: [] as unknown[] }),
    prendaIds.length > 0 ? insforgeDb().from('prendas').select('*').in('id', prendaIds) : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const tallaMap = new Map(
    (tRes.data || []).map((t) => {
      const id = String((t as { id: string }).id);
      return [normIdKey(id), t] as const;
    })
  );
  const prendaMap = new Map(
    (pRes.data || []).map((p) => {
      const id = String((p as { id: string }).id);
      return [normIdKey(id), p] as const;
    })
  );
  return rows.map((raw) => {
    const row = normalizarCamposCostoApi(raw as Record<string, unknown>);
    const tid = readCol(row, 'talla_id', 'tallaId');
    const pid = readCol(row, 'prenda_id', 'prendaId');
    const enriched: Record<string, unknown> = { ...row };
    if (tid && tallaMap.has(normIdKey(tid))) enriched.tallas = tallaMap.get(normIdKey(tid));
    if (pid && prendaMap.has(normIdKey(pid))) enriched.prendas = prendaMap.get(normIdKey(pid));
    return normalizeCostoRow(enriched);
  });
}

function sortCostosPorFecha(rows: Costo[]): Costo[] {
  const ts = (c: Costo) => {
    const raw = (c as unknown as Record<string, unknown>).created_at ?? (c as unknown as Record<string, unknown>).createdAt;
    const n = raw ? Date.parse(String(raw)) : 0;
    return Number.isNaN(n) ? 0 : n;
  };
  return [...rows].sort((a, b) => ts(b) - ts(a));
}

export function useCostos(sucursal_id?: string) {
  const [costos, setCostos] = useState<Costo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostos = async () => {
    try {
      setLoading(true);
      let query = insforgeDb().from('costos').select(COSTOS_EMBED).order('created_at', { ascending: false });
      let { data, error } = await query;

      if (!error && data?.length) {
        let rows = (data || []).map((r) => r as Record<string, unknown>);
        rows = filtrarFilasPorSucursalSiHayColumna(rows, sucursal_id);
        setCostos(
          sortCostosPorFecha(
            rows.map((r) =>
              normalizeCostoRow(normalizarCamposCostoApi(r as Record<string, unknown>))
            )
          )
        );
        setError(null);
        return;
      }

      let fallback = await insforgeDb().from('costos').select('*').order('created_at', { ascending: false });
      if (fallback.error) {
        fallback = await insforgeDb().from('costos').select('*');
      }
      if (fallback.error) throw fallback.error;
      let plain = (fallback.data || []) as Record<string, unknown>[];
      plain = filtrarFilasPorSucursalSiHayColumna(plain, sucursal_id);
      const enriched = await enrichCostosFromPlainRows(plain);
      setCostos(sortCostosPorFecha(enriched));
      setError(null);
    } catch (err: unknown) {
      setError(getSupabaseErrorMessage(err));
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
      const { data, error } = await insforgeDb().from('costos').insert([costo]).select('*').single();

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
      const { data, error } = await insforgeDb().from('costos').insert(costos).select('*');

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
      const { error } = await insforgeDb()
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

  /** Por prenda; prueba FK snake_case y camelCase (`fetchCostosRowsByPrenda`). Enriquece tallas/prendas como `fetchCostos`. */
  const getCostosByPrenda = async (prenda_id: string) => {
    try {
      let rows = await fetchCostosRowsByPrenda(insforgeDb(), prenda_id);
      rows = filtrarFilasPorSucursalSiHayColumna(rows as Record<string, unknown>[], sucursal_id) as Record<
        string,
        unknown
      >[];
      const enriched = await enrichCostosFromPlainRows(rows);
      return { data: enriched, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: [], error: msg };
    }
  };

  const updateCosto = async (id: string, updates: Partial<Costo>) => {
    try {
      const payload = { ...updates };
      delete (payload as Partial<Costo & { talla?: unknown; prenda?: unknown }>).talla;
      delete (payload as Partial<Costo & { talla?: unknown; prenda?: unknown }>).prenda;

      const { data, error } = await insforgeDb().from('costos').update(payload).eq('id', id).select('*').single();

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


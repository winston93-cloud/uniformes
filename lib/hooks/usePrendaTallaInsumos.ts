import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PrendaTallaInsumo {
  id: string;
  prenda_id: string;
  talla_id: string;
  insumo_id: string;
  cantidad: number;
  created_at?: string;
  updated_at?: string;
  insumo?: {
    id: string;
    nombre: string;
    presentacion_id: string | null;
    presentacion?: {
      nombre: string;
      descripcion: string;
    };
  };
}

function normRow<T extends Record<string, unknown>>(r: T): T & Record<string, unknown> {
  return {
    ...r,
    insumo_id: r.insumo_id ?? r.insumoId,
    prenda_id: r.prenda_id ?? r.prendaId,
    talla_id: r.talla_id ?? r.tallaId,
  } as T & Record<string, unknown>;
}

async function enrichPrendaTallaInsumosRows(
  rows: Record<string, unknown>[]
): Promise<PrendaTallaInsumo[]> {
  if (!rows.length) return [];
  const insumoIds = [
    ...new Set(
      rows.map((r) => String(r.insumo_id ?? r.insumoId ?? '')).filter(Boolean)
    ),
  ];
  let insMap = new Map<string, Record<string, unknown>>();
  let presMap = new Map<string, { nombre: string; descripcion: string }>();

  if (insumoIds.length > 0) {
    const { data: insRows, error: insErr } = await supabase
      .from('insumos')
      .select('id, nombre, presentacion_id')
      .in('id', insumoIds);
    if (insErr) throw insErr;
    for (const ins of insRows || []) {
      const x = ins as Record<string, unknown>;
      const id = String(x.id ?? '');
      insMap.set(id, x);
    }
    const presIds = [
      ...new Set(
        [...insMap.values()]
          .map((x) => x.presentacion_id ?? x.presentacionId)
          .filter(Boolean)
          .map(String)
      ),
    ];
    if (presIds.length > 0) {
      const { data: prs, error: prErr } = await supabase
        .from('presentaciones')
        .select('id, nombre, descripcion')
        .in('id', presIds);
      if (prErr) throw prErr;
      for (const p of prs || []) {
        const x = p as Record<string, unknown>;
        presMap.set(String(x.id), {
          nombre: String(x.nombre ?? ''),
          descripcion: String(x.descripcion ?? ''),
        });
      }
    }
  }

  return rows.map((raw) => {
    const r = normRow(raw as Record<string, unknown>);
    const iid = String(r.insumo_id ?? '');
    const ins = insMap.get(iid);
    const pid = ins?.presentacion_id ?? ins?.presentacionId;
    const pres = pid ? presMap.get(String(pid)) : undefined;
    const insumoObj =
      ins &&
      ({
        id: String(ins.id ?? iid),
        nombre: String(ins.nombre ?? ''),
        presentacion_id: ins.presentacion_id != null ? String(ins.presentacion_id) : null,
        presentacion: pres,
      } as PrendaTallaInsumo['insumo']);

    return {
      ...r,
      id: String(r.id ?? ''),
      prenda_id: String(r.prenda_id ?? ''),
      talla_id: String(r.talla_id ?? ''),
      insumo_id: iid,
      cantidad: Number(r.cantidad ?? 0),
      insumo: insumoObj,
    } as PrendaTallaInsumo;
  });
}

export function usePrendaTallaInsumos(prendaId?: string, tallaId?: string) {
  const [insumos, setInsumos] = useState<PrendaTallaInsumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsumos = async () => {
    if (!prendaId || !tallaId) return;

    setLoading(true);
    setError(null);

    try {
      let q = supabase
        .from('prenda_talla_insumos')
        .select('*')
        .eq('prenda_id', prendaId)
        .eq('talla_id', tallaId)
        .order('created_at', { ascending: true });

      let { data, error: fetchError } = await q;
      if (fetchError) {
        const fb = await supabase
          .from('prenda_talla_insumos')
          .select('*')
          .eq('prenda_id', prendaId)
          .eq('talla_id', tallaId);
        if (!fb.error) {
          data = fb.data;
          fetchError = null;
        }
      }
      if (fetchError) throw fetchError;

      const enriched = await enrichPrendaTallaInsumosRows((data || []) as Record<string, unknown>[]);
      setInsumos(enriched);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('Error fetching prenda-talla-insumos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prendaId && tallaId) {
      fetchInsumos();
    }
  }, [prendaId, tallaId]);

  const createInsumo = async (insumoId: string, cantidad: number) => {
    if (!prendaId || !tallaId) {
      throw new Error('Prenda ID y Talla ID son requeridos');
    }

    const { data, error: createError } = await supabase
      .from('prenda_talla_insumos')
      .insert({
        prenda_id: prendaId,
        talla_id: tallaId,
        insumo_id: insumoId,
        cantidad,
      })
      .select('*')
      .single();

    if (createError) throw createError;

    await fetchInsumos();
    const [one] = await enrichPrendaTallaInsumosRows([(data || {}) as Record<string, unknown>]);
    return one;
  };

  const updateInsumo = async (id: string, cantidad: number) => {
    const { error: updateError } = await supabase
      .from('prenda_talla_insumos')
      .update({ cantidad })
      .eq('id', id);

    if (updateError) throw updateError;

    await fetchInsumos();
  };

  const deleteInsumo = async (id: string) => {
    const { error: deleteError } = await supabase.from('prenda_talla_insumos').delete().eq('id', id);

    if (deleteError) throw deleteError;

    await fetchInsumos();
  };

  const getInsumosByPrendaTalla = async (prendaIdParam: string, tallaIdParam: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('prenda_talla_insumos')
        .select('*')
        .eq('prenda_id', prendaIdParam)
        .eq('talla_id', tallaIdParam);

      if (fetchError) throw fetchError;
      return enrichPrendaTallaInsumosRows((data || []) as Record<string, unknown>[]);
    } catch (err) {
      console.error('Error fetching insumos:', err);
      return [];
    }
  };

  return {
    insumos,
    loading,
    error,
    createInsumo,
    updateInsumo,
    deleteInsumo,
    refetch: fetchInsumos,
    getInsumosByPrendaTalla,
  };
}

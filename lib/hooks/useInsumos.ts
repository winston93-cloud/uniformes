import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Insumo } from '../types';

/** Sin alias `foo:tabla(*)` — InsForge puede responder 400. */
const INSUMOS_EMBED = `
          *,
          presentaciones(*),
          ubicaciones_almacenamiento(*),
          insumo_ubicaciones (
            id,
            insumo_id,
            cantidad,
            ubicacion_almacenamiento_id,
            ubicaciones_almacenamiento ( id, nombre )
          )
        `;

function normalizeInsumo(row: Record<string, unknown>): Insumo {
  const r = row as Record<string, unknown> & {
    presentacion?: unknown;
    presentaciones?: unknown;
    ubicacion_almacenamiento?: unknown;
    ubicaciones_almacenamiento?: unknown;
    insumo_ubicaciones?: Array<Record<string, unknown>>;
  };
  const presRaw = r.presentacion ?? r.presentaciones;
  const uaRaw = r.ubicacion_almacenamiento ?? r.ubicaciones_almacenamiento;
  const pres = Array.isArray(presRaw) ? presRaw[0] : presRaw;
  const ua = Array.isArray(uaRaw) ? uaRaw[0] : uaRaw;
  const locs = (r.insumo_ubicaciones || []).map((iu) => {
    const x = iu as Record<string, unknown>;
    const ur = x.ubicacion ?? x.ubicaciones_almacenamiento;
    const ub = Array.isArray(ur) ? ur[0] : ur;
    const { ubicaciones_almacenamiento: _a, ubicacion: _b, ...iuRest } = x;
    return { ...iuRest, ubicacion: ub };
  });
  const { presentaciones: _p, ubicaciones_almacenamiento: _ua, ...rest } = r;
  return {
    ...rest,
    presentacion: pres as Insumo['presentacion'],
    ubicacion_almacenamiento: ua as Insumo['ubicacion_almacenamiento'],
    insumo_ubicaciones: locs as Insumo['insumo_ubicaciones'],
  } as Insumo;
}

export function useInsumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsumos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('insumos').select(INSUMOS_EMBED).order('created_at', { ascending: false });

      if (error) throw error;
      setInsumos((data || []).map((row) => normalizeInsumo(row as Record<string, unknown>)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsumos();

    // Suscripción en tiempo real
    const subscription = supabase
      .channel('insumos_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'insumos' 
      }, () => {
        fetchInsumos();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'insumo_ubicaciones',
      }, () => {
        fetchInsumos();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const createInsumo = async (insumoData: Omit<Insumo, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Validar duplicado por nombre
      const { data: existingByName } = await supabase
        .from('insumos')
        .select('id')
        .ilike('nombre', insumoData.nombre)
        .maybeSingle();

      if (existingByName) {
        return { data: null, error: 'Ya existe un insumo con ese nombre' };
      }

      // Validar duplicado por código
      const { data: existingByCode } = await supabase
        .from('insumos')
        .select('id')
        .ilike('codigo', insumoData.codigo)
        .maybeSingle();

      if (existingByCode) {
        return { data: null, error: 'Ya existe un insumo con ese código' };
      }

      const { data, error } = await supabase
        .from('insumos')
        .insert([insumoData])
        .select()
        .single();

      if (error) throw error;
      await fetchInsumos();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updateInsumo = async (id: string, insumoData: Partial<Insumo>) => {
    try {
      // Validar duplicado por nombre (excluyendo el registro actual)
      if (insumoData.nombre) {
        const { data: existingByName } = await supabase
          .from('insumos')
          .select('id')
          .ilike('nombre', insumoData.nombre)
          .neq('id', id)
          .maybeSingle();

        if (existingByName) {
          return { data: null, error: 'Ya existe un insumo con ese nombre' };
        }
      }

      // Validar duplicado por código (excluyendo el registro actual)
      if (insumoData.codigo) {
        const { data: existingByCode } = await supabase
          .from('insumos')
          .select('id')
          .ilike('codigo', insumoData.codigo)
          .neq('id', id)
          .maybeSingle();

        if (existingByCode) {
          return { data: null, error: 'Ya existe un insumo con ese código' };
        }
      }

      const { data, error } = await supabase
        .from('insumos')
        .update(insumoData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchInsumos();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deleteInsumo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insumos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchInsumos();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const searchInsumos = async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select(INSUMOS_EMBED)
        .or(`nombre.ilike.%${query}%,codigo.ilike.%${query}%,descripcion.ilike.%${query}%`)
        .order('nombre', { ascending: true });

      if (error) throw error;
      return (data || []).map((row) => normalizeInsumo(row as Record<string, unknown>));
    } catch (err: any) {
      console.error('Error buscando insumos:', err);
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
    searchInsumos,
    refetch: fetchInsumos,
  };
}


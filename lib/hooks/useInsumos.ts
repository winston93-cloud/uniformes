import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Insumo } from '../types';

export function useInsumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsumos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insumos')
        .select('*, presentacion:presentaciones(*)')
        .order('created_at', { ascending: false});

      if (error) throw error;
      setInsumos(data || []);
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
          .single();

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
        .select('*, presentacion:presentaciones(*)')
        .or(`nombre.ilike.%${query}%,codigo.ilike.%${query}%,descripcion.ilike.%${query}%`)
        .order('nombre', { ascending: true });

      if (error) throw error;
      return data || [];
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


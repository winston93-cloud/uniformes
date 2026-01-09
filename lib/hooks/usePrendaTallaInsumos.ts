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
  // Datos relacionados
  insumo?: {
    id: string;
    nombre: string;
    presentacion_id: string;
    presentacion?: {
      nombre: string;
      descripcion: string;
    };
  };
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
      const { data, error: fetchError } = await supabase
        .from('prenda_talla_insumos')
        .select(`
          *,
          insumo:insumos(
            id,
            nombre,
            presentacion_id,
            presentacion:presentaciones(
              nombre,
              unidad_medida
            )
          )
        `)
        .eq('prenda_id', prendaId)
        .eq('talla_id', tallaId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setInsumos(data || []);
    } catch (err: any) {
      setError(err.message);
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

    try {
      const { data, error: createError } = await supabase
        .from('prenda_talla_insumos')
        .insert({
          prenda_id: prendaId,
          talla_id: tallaId,
          insumo_id: insumoId,
          cantidad
        })
        .select(`
          *,
          insumo:insumos(
            id,
            nombre,
            presentacion_id,
            presentacion:presentaciones(
              nombre,
              unidad_medida
            )
          )
        `)
        .single();

      if (createError) throw createError;
      
      await fetchInsumos();
      return data;
    } catch (err: any) {
      console.error('Error creating prenda-talla-insumo:', err);
      throw err;
    }
  };

  const updateInsumo = async (id: string, cantidad: number) => {
    try {
      const { error: updateError } = await supabase
        .from('prenda_talla_insumos')
        .update({ cantidad })
        .eq('id', id);

      if (updateError) throw updateError;
      
      await fetchInsumos();
    } catch (err: any) {
      console.error('Error updating prenda-talla-insumo:', err);
      throw err;
    }
  };

  const deleteInsumo = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('prenda_talla_insumos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      
      await fetchInsumos();
    } catch (err: any) {
      console.error('Error deleting prenda-talla-insumo:', err);
      throw err;
    }
  };

  const getInsumosByPrendaTalla = async (prendaIdParam: string, tallaIdParam: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('prenda_talla_insumos')
        .select(`
          *,
          insumo:insumos(
            id,
            nombre,
            presentacion_id,
            presentacion:presentaciones(
              nombre,
              unidad_medida
            )
          )
        `)
        .eq('prenda_id', prendaIdParam)
        .eq('talla_id', tallaIdParam);

      if (fetchError) throw fetchError;
      return data || [];
    } catch (err: any) {
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
    getInsumosByPrendaTalla
  };
}

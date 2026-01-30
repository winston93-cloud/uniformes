'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Transferencia } from '../types';

export function useTransferencias(sucursalId?: string) {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarTransferencias = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('transferencias')
        .select(`
          *,
          sucursal_origen:sucursales!transferencias_sucursal_origen_id_fkey(id, codigo, nombre, es_matriz),
          sucursal_destino:sucursales!transferencias_sucursal_destino_id_fkey(id, codigo, nombre, es_matriz),
          usuario:usuarios(id, usuario, nombre)
        `)
        .order('created_at', { ascending: false });

      if (sucursalId) {
        query = query.or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`);
      }

      const { data, error: errorSupabase } = await query;

      if (errorSupabase) throw errorSupabase;

      setTransferencias(data || []);
    } catch (err) {
      console.error('Error cargando transferencias:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [sucursalId]);

  useEffect(() => {
    cargarTransferencias();
  }, [cargarTransferencias]);

  const recargar = useCallback(() => {
    cargarTransferencias();
  }, [cargarTransferencias]);

  return {
    transferencias,
    loading,
    error,
    recargar,
  };
}

export async function crearTransferencia(
  sucursal_origen_id: string,
  sucursal_destino_id: string,
  usuario_id: string,
  detalles: Array<{ prenda_id: string; talla_id: string; cantidad: number; costo_id: string }>,
  observaciones?: string
) {
  // 1. Crear transferencia
  const { data: transferencia, error: errorTransferencia } = await supabase
    .from('transferencias')
    .insert([{
      sucursal_origen_id,
      sucursal_destino_id,
      usuario_id,
      estado: 'PENDIENTE',
      observaciones,
    }])
    .select()
    .single();

  if (errorTransferencia) throw errorTransferencia;

  // 2. Insertar detalles
  const detallesConId = detalles.map(d => ({
    ...d,
    transferencia_id: transferencia.id,
  }));

  const { error: errorDetalles } = await supabase
    .from('detalle_transferencias')
    .insert(detallesConId);

  if (errorDetalles) throw errorDetalles;

  return transferencia;
}

export async function procesarTransferencia(transferencia_id: string) {
  // Cambiar estado a RECIBIDA y actualizar inventarios
  const { data: transferencia, error } = await supabase
    .from('transferencias')
    .update({ estado: 'RECIBIDA' })
    .eq('id', transferencia_id)
    .select(`
      *,
      detalles:detalle_transferencias(*)
    `)
    .single();

  if (error) throw error;
  
  // Aquí iría la lógica de actualización de stock
  // Por ahora solo cambia el estado
  
  return transferencia;
}

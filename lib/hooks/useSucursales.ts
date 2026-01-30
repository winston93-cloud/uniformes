'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Sucursal } from '../types';

export function useSucursales() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarSucursales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: errorSupabase } = await supabase
        .from('sucursales')
        .select('*')
        .order('es_matriz', { ascending: false }) // Matriz primero
        .order('nombre', { ascending: true });

      if (errorSupabase) throw errorSupabase;

      setSucursales(data || []);
    } catch (err) {
      console.error('Error cargando sucursales:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarSucursales();
  }, [cargarSucursales]);

  const recargar = useCallback(() => {
    cargarSucursales();
  }, [cargarSucursales]);

  return {
    sucursales,
    loading,
    error,
    recargar,
  };
}

export async function crearSucursal(sucursal: Partial<Sucursal>) {
  const { data, error } = await supabase
    .from('sucursales')
    .insert([sucursal])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function actualizarSucursal(id: string, sucursal: Partial<Sucursal>) {
  const { data, error } = await supabase
    .from('sucursales')
    .update(sucursal)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function eliminarSucursal(id: string) {
  const { error } = await supabase
    .from('sucursales')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

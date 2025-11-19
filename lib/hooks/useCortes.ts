'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Corte } from '../types';

export function useCortes() {
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCortes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cortes')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;
      setCortes(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching cortes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCortes();
  }, []);

  const crearCorte = async (fechaInicio: string, fechaFin: string) => {
    try {
      // Primero, obtener todos los pedidos liquidados en ese período
      const fechaInicioObj = new Date(fechaInicio + 'T00:00:00');
      const fechaFinObj = new Date(fechaFin + 'T23:59:59');

      const { data: pedidos, error: pedidosError } = await supabase
        .from('pedidos')
        .select('id, total, estado')
        .eq('estado', 'LIQUIDADO')
        .not('fecha_liquidacion', 'is', null)
        .gte('fecha_liquidacion', fechaInicioObj.toISOString())
        .lte('fecha_liquidacion', fechaFinObj.toISOString());

      if (pedidosError) throw pedidosError;

      const totalVentas = pedidos?.reduce((sum, p) => sum + parseFloat(p.total.toString()), 0) || 0;
      const totalPedidos = pedidos?.length || 0;

      // Crear el corte
      const { data, error } = await supabase
        .from('cortes')
        .insert([
          {
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            total_ventas: totalVentas,
            total_pedidos: totalPedidos,
            activo: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Crear los detalles del corte (relación con pedidos)
      if (pedidos && pedidos.length > 0) {
        const detalles = pedidos.map((pedido) => ({
          corte_id: data.id,
          pedido_id: pedido.id,
        }));

        const { error: detallesError } = await supabase
          .from('detalle_cortes')
          .insert(detalles);

        if (detallesError) {
          console.error('Error creating detalle_cortes:', detallesError);
          // No lanzamos error porque el corte ya se creó
        }
      }

      await fetchCortes();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const getDetalleCorte = async (corteId: string) => {
    try {
      const { data, error } = await supabase
        .from('detalle_cortes')
        .select(`
          *,
          pedido:pedidos(
            *,
            alumno:alumno(alumno_ref, alumno_nombre_completo),
            externo:externos(nombre)
          )
        `)
        .eq('corte_id', corteId);

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const cerrarCorte = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('cortes')
        .update({ activo: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchCortes();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  return {
    cortes,
    loading,
    error,
    crearCorte,
    getDetalleCorte,
    cerrarCorte,
    refetch: fetchCortes,
  };
}


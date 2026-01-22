'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Cotizacion, DetalleCotizacion } from '@/lib/types';

export interface PartidaCotizacion {
  prenda_nombre: string;
  talla: string;
  color: string;
  especificaciones: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  orden: number;
}

export interface NuevaCotizacion {
  alumno_id?: string;
  externo_id?: string;
  tipo_cliente: 'alumno' | 'externo';
  fecha_vigencia?: string;
  observaciones?: string;
  condiciones_pago?: string;
  tiempo_entrega?: string;
  partidas: PartidaCotizacion[];
}

export function useCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener todas las cotizaciones
  const obtenerCotizaciones = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('cotizaciones')
        .select(`
          *,
          alumno:alumnos(*),
          externo:externos(*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setCotizaciones(data || []);
    } catch (err) {
      console.error('Error al obtener cotizaciones:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }, []);

  // Obtener una cotización con su detalle
  const obtenerCotizacion = useCallback(async (id: string) => {
    try {
      const { data: cotizacion, error: cotError } = await supabase
        .from('cotizaciones')
        .select(`
          *,
          alumno:alumnos(*),
          externo:externos(*)
        `)
        .eq('id', id)
        .single();

      if (cotError) throw cotError;

      const { data: detalle, error: detError } = await supabase
        .from('detalle_cotizacion')
        .select('*')
        .eq('cotizacion_id', id)
        .order('orden', { ascending: true });

      if (detError) throw detError;

      return { cotizacion, detalle: detalle || [] };
    } catch (err) {
      console.error('Error al obtener cotización:', err);
      throw err;
    }
  }, []);

  // Generar folio automático
  const generarFolio = async (): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc('generar_folio_cotizacion');
      if (error) throw error;
      return data as string;
    } catch (err) {
      console.error('Error al generar folio:', err);
      throw err;
    }
  };

  // Crear cotización
  const crearCotizacion = async (nuevaCotizacion: NuevaCotizacion) => {
    try {
      // 1. Generar folio
      const folio = await generarFolio();

      // 2. Calcular totales
      const subtotal = nuevaCotizacion.partidas.reduce((sum, p) => sum + p.subtotal, 0);
      const total = subtotal;

      // 3. Crear cotización
      const { data: cotizacion, error: cotError } = await supabase
        .from('cotizaciones')
        .insert([{
          folio,
          alumno_id: nuevaCotizacion.alumno_id || null,
          externo_id: nuevaCotizacion.externo_id || null,
          tipo_cliente: nuevaCotizacion.tipo_cliente,
          fecha_cotizacion: new Date().toISOString().split('T')[0],
          fecha_vigencia: nuevaCotizacion.fecha_vigencia || null,
          subtotal,
          total,
          observaciones: nuevaCotizacion.observaciones || null,
          condiciones_pago: nuevaCotizacion.condiciones_pago || '50% anticipo, 50% contra entrega',
          tiempo_entrega: nuevaCotizacion.tiempo_entrega || '5-7 días hábiles',
          estado: 'vigente',
        }])
        .select()
        .single();

      if (cotError) throw cotError;

      // 4. Crear partidas
      const partidas = nuevaCotizacion.partidas.map((p, index) => ({
        cotizacion_id: cotizacion.id,
        ...p,
        orden: index + 1,
      }));

      const { error: detError } = await supabase
        .from('detalle_cotizacion')
        .insert(partidas);

      if (detError) throw detError;

      await obtenerCotizaciones();
      return { data: cotizacion, error: null };
    } catch (err) {
      console.error('Error al crear cotizacion:', err);
      return { data: null, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  // Actualizar estado de cotización
  const actualizarEstado = async (id: string, estado: 'vigente' | 'aceptada' | 'rechazada' | 'vencida') => {
    try {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado })
        .eq('id', id);

      if (error) throw error;
      await obtenerCotizaciones();
      return { error: null };
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      return { error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  // Actualizar PDF URL
  const actualizarPdfUrl = async (id: string, pdfUrl: string) => {
    try {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ pdf_url: pdfUrl })
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error al actualizar PDF URL:', err);
      return { error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  // Eliminar cotización
  const eliminarCotizacion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cotizaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await obtenerCotizaciones();
      return { error: null };
    } catch (err) {
      console.error('Error al eliminar cotizacion:', err);
      return { error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  useEffect(() => {
    obtenerCotizaciones();
  }, [obtenerCotizaciones]);

  return {
    cotizaciones,
    cargando,
    error,
    obtenerCotizaciones,
    obtenerCotizacion,
    crearCotizacion,
    actualizarEstado,
    actualizarPdfUrl,
    eliminarCotizacion,
  };
}

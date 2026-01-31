'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Devolucion {
  id: string;
  folio: number;
  pedido_id: string;
  sucursal_id: string;
  usuario_id: number;
  tipo_devolucion: 'COMPLETA' | 'PARCIAL' | 'CAMBIO_TALLA' | 'CAMBIO_PRENDA';
  motivo: string;
  observaciones?: string;
  total_devolucion: number;
  reembolso_aplicado: boolean;
  monto_reembolsado: number;
  estado: 'PENDIENTE' | 'PROCESADA' | 'CANCELADA';
  created_at: string;
  updated_at: string;
}

export interface DetalleDevolucion {
  id?: string;
  devolucion_id: string;
  detalle_pedido_id: string;
  prenda_id: string;
  talla_id: string;
  cantidad_devuelta: number;
  precio_unitario: number;
  subtotal: number;
  es_cambio: boolean;
  prenda_cambio_id?: string;
  talla_cambio_id?: string;
  cantidad_cambio?: number;
  precio_cambio?: number;
  observaciones_detalle?: string;
}

export interface DevolucionConDetalles extends Devolucion {
  detalles: DetalleDevolucion[];
  pedido?: {
    cliente_nombre: string;
    total: number;
  };
  usuario?: {
    usuario_nombre: string;
    usuario_username: string;
  };
}

export interface CrearDevolucionData {
  pedido_id: string;
  sucursal_id: string;
  usuario_id: number;
  tipo_devolucion: Devolucion['tipo_devolucion'];
  motivo: string;
  observaciones?: string;
  reembolso_aplicado?: boolean;
  monto_reembolsado?: number;
  detalles: Omit<DetalleDevolucion, 'id' | 'devolucion_id'>[];
}

export function useDevoluciones(sucursal_id?: string) {
  const [devoluciones, setDevoluciones] = useState<DevolucionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevoluciones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('devoluciones')
        .select(`
          *,
          pedido:pedidos(cliente_nombre, total),
          usuario(usuario_nombre, usuario_username)
        `)
        .order('created_at', { ascending: false });

      if (sucursal_id) {
        query = query.eq('sucursal_id', sucursal_id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Obtener detalles de cada devolución
      const devolucionesConDetalles: DevolucionConDetalles[] = [];
      
      for (const dev of data || []) {
        const { data: detalles, error: detallesError } = await supabase
          .from('detalle_devoluciones')
          .select('*')
          .eq('devolucion_id', dev.id);

        if (detallesError) {
          console.error('Error al cargar detalles:', detallesError);
          continue;
        }

        devolucionesConDetalles.push({
          ...dev,
          detalles: detalles || [],
          pedido: Array.isArray(dev.pedido) ? dev.pedido[0] : dev.pedido,
          usuario: Array.isArray(dev.usuario) ? dev.usuario[0] : dev.usuario,
        });
      }

      setDevoluciones(devolucionesConDetalles);
    } catch (err: any) {
      console.error('Error al cargar devoluciones:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sucursal_id]);

  useEffect(() => {
    fetchDevoluciones();
  }, [fetchDevoluciones]);

  const crearDevolucion = async (data: CrearDevolucionData) => {
    try {
      console.log('📦 Creando devolución...', data);

      // 1. Calcular total de devolución
      const totalDevolucion = data.detalles.reduce(
        (sum, det) => sum + det.subtotal,
        0
      );

      // 2. Insertar devolución
      const { data: devolucion, error: devError } = await supabase
        .from('devoluciones')
        .insert({
          pedido_id: data.pedido_id,
          sucursal_id: data.sucursal_id,
          usuario_id: data.usuario_id,
          tipo_devolucion: data.tipo_devolucion,
          motivo: data.motivo,
          observaciones: data.observaciones,
          total_devolucion: totalDevolucion,
          reembolso_aplicado: data.reembolso_aplicado || false,
          monto_reembolsado: data.monto_reembolsado || 0,
          estado: 'PENDIENTE',
        })
        .select()
        .single();

      if (devError) {
        console.error('❌ Error al crear devolución:', devError);
        throw devError;
      }

      console.log('✅ Devolución creada:', devolucion);

      // 3. Insertar detalles
      const detallesConId = data.detalles.map((det) => ({
        ...det,
        devolucion_id: devolucion.id,
      }));

      const { error: detallesError } = await supabase
        .from('detalle_devoluciones')
        .insert(detallesConId);

      if (detallesError) {
        console.error('❌ Error al insertar detalles:', detallesError);
        throw detallesError;
      }

      // 4. DEVOLVER STOCK al inventario (suma)
      for (const detalle of data.detalles) {
        const { data: costoData, error: costoError } = await supabase
          .from('costos')
          .select('stock')
          .eq('prenda_id', detalle.prenda_id)
          .eq('talla_id', detalle.talla_id)
          .eq('sucursal_id', data.sucursal_id)
          .single();

        if (costoError) {
          console.error('⚠️ No se encontró el costo para devolver stock:', costoError);
          continue;
        }

        // DEVOLVER = SUMAR al stock
        const nuevoStock = (costoData.stock || 0) + detalle.cantidad_devuelta;
        
        const { error: updateError } = await supabase
          .from('costos')
          .update({ stock: nuevoStock })
          .eq('prenda_id', detalle.prenda_id)
          .eq('talla_id', detalle.talla_id)
          .eq('sucursal_id', data.sucursal_id);

        if (updateError) {
          console.error('❌ Error al devolver stock:', updateError);
        } else {
          console.log(`✅ Stock devuelto: +${detalle.cantidad_devuelta} → Total: ${nuevoStock}`);
        }

        // 5. Si es CAMBIO: restar del nuevo stock
        if (detalle.es_cambio && detalle.prenda_cambio_id && detalle.talla_cambio_id) {
          const { data: costoCambioData, error: costoCambioError } = await supabase
            .from('costos')
            .select('stock')
            .eq('prenda_id', detalle.prenda_cambio_id)
            .eq('talla_id', detalle.talla_cambio_id)
            .eq('sucursal_id', data.sucursal_id)
            .single();

          if (costoCambioError) {
            console.error('⚠️ No se encontró el costo para el cambio:', costoCambioError);
            continue;
          }

          const nuevoStockCambio = (costoCambioData.stock || 0) - (detalle.cantidad_cambio || 0);

          const { error: updateCambioError } = await supabase
            .from('costos')
            .update({ stock: nuevoStockCambio })
            .eq('prenda_id', detalle.prenda_cambio_id)
            .eq('talla_id', detalle.talla_cambio_id)
            .eq('sucursal_id', data.sucursal_id);

          if (updateCambioError) {
            console.error('❌ Error al actualizar stock de cambio:', updateCambioError);
          } else {
            console.log(`✅ Stock cambio: -${detalle.cantidad_cambio} → Total: ${nuevoStockCambio}`);
          }
        }
      }

      // 6. Recargar devoluciones
      await fetchDevoluciones();

      return { success: true, data: devolucion };
    } catch (err: any) {
      console.error('❌ Error en crearDevolucion:', err);
      return { success: false, error: err.message };
    }
  };

  const procesarDevolucion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('devoluciones')
        .update({ estado: 'PROCESADA' })
        .eq('id', id);

      if (error) throw error;

      await fetchDevoluciones();
      return { success: true };
    } catch (err: any) {
      console.error('Error al procesar devolución:', err);
      return { success: false, error: err.message };
    }
  };

  const cancelarDevolucion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('devoluciones')
        .update({ estado: 'CANCELADA' })
        .eq('id', id);

      if (error) throw error;

      await fetchDevoluciones();
      return { success: true };
    } catch (err: any) {
      console.error('Error al cancelar devolución:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    devoluciones,
    loading,
    error,
    fetchDevoluciones,
    crearDevolucion,
    procesarDevolucion,
    cancelarDevolucion,
  };
}

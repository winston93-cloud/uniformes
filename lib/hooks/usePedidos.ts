'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { REFETCH_PEDIDOS_EVENT } from '@/lib/refetchPedidosEvent';

interface Pedido {
  id: string;
  /** Folio de venta (ej. PED-YYYYMM-0001), p. ej. generado al cerrar cotización terminada */
  folio?: string | null;
  cotizacion_id?: string | null;
  fecha: string;
  cliente_id: string;
  cliente_tipo: 'alumno' | 'externo';
  cliente_nombre: string;
  total: number;
  estado: 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO' | 'CANCELADO_PARCIAL';
  observaciones?: string;
  modalidad_pago: 'TOTAL' | 'ANTICIPO';
  efectivo_recibido: number | string;
  created_at?: string;
  updated_at?: string;
}

interface DetallePedido {
  id?: string;
  pedido_id: string;
  prenda_id: string;
  talla_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  pendiente: number;
  especificaciones?: string;
}

export function usePedidos(sucursal_id?: string) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPedidos = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false});

      // Filtrar por sucursal si se proporciona
      if (sucursal_id) {
        query = query.eq('sucursal_id', sucursal_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Mapear tipo_cliente a cliente_tipo para compatibilidad
      const pedidosMapeados = (data || []).map((p: any) => ({
        ...p,
        cliente_tipo: p.tipo_cliente,
        fecha: new Date(p.created_at).toLocaleDateString('es-MX'),
      }));
      
      setPedidos(pedidosMapeados);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [sucursal_id]);

  const crearPedido = async (pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>, detalles: Omit<DetallePedido, 'id' | 'pedido_id'>[], pedido_sucursal_id?: string, usuario_id?: number | string) => {
    try {
      console.log('📦 Creando pedido con función atómica...', pedido);
      
      // Preparar detalles en formato JSONB para la función
      // CRÍTICO: Incluir cantidad_con_stock y cantidad_pendiente para división automática
      const detallesJsonb = detalles.map(det => ({
        prenda_id: det.prenda_id,
        talla_id: det.talla_id,
        cantidad: det.cantidad,
        // IMPORTANTE: Usar !== undefined en vez de || porque 0 es un valor válido
        cantidad_con_stock: (det as any).cantidad_con_stock !== undefined ? (det as any).cantidad_con_stock : det.cantidad,
        cantidad_pendiente: (det as any).cantidad_pendiente !== undefined ? (det as any).cantidad_pendiente : 0,
        tiene_stock: (det as any).tiene_stock !== false,
        especificaciones: det.especificaciones || ''
      }));

      // Manejar usuario_id: enviar NULL si no es válido
      // Esto evita problemas con foreign keys
      const usuario_uuid = typeof usuario_id === 'string' && usuario_id.length > 0
        ? usuario_id 
        : null; // NULL si no hay usuario válido

      // LLAMAR A LA FUNCIÓN ATÓMICA que hace TODO en una transacción
      const { data, error } = await supabase.rpc('crear_pedido_atomico', {
        p_tipo_cliente: pedido.cliente_tipo,
        p_cliente_nombre: pedido.cliente_nombre,
        p_sucursal_id: pedido_sucursal_id || sucursal_id,
        p_usuario_id: usuario_uuid,
        p_alumno_id: null,
        p_externo_id: null,
        p_estado: pedido.estado,
        p_notas: pedido.observaciones || null,
        p_detalles: detallesJsonb
      });

      if (error) {
        console.error('❌ Error en función atómica:', error);
        throw error;
      }

      console.log('✅ Respuesta función atómica:', data);

      // Verificar respuesta
      if (!data.success) {
        throw new Error(data.error || data.message || 'Error desconocido');
      }

      await fetchPedidos();
      return { 
        success: true, 
        data: { id: data.pedido_id },
        message: data.message 
      };
    } catch (error: any) {
      console.error('❌ Error al crear pedido:', error);
      return { 
        success: false, 
        error: error.message || error 
      };
    }
  };

  const actualizarEstadoPedido = async (
    id: string,
    nuevoEstado: Pedido['estado'],
    usuario_id?: string | null
  ) => {
    try {
      // COMPLETADO: debe descontar pendientes en BD de forma atómica
      if (nuevoEstado === 'COMPLETADO') {
        const { data, error } = await supabase.rpc('completar_pedido_atomico', {
          p_pedido_id: id,
          p_usuario_id: usuario_id ?? null,
        });
        if (error) throw error;
        if (data && data.success === false) {
          throw new Error(data.error || 'Error al completar pedido');
        }
      } else {
        const { error } = await supabase
          .from('pedidos')
          .update({ estado: nuevoEstado })
          .eq('id', id);

        if (error) throw error;
      }

      await fetchPedidos();
      return { success: true };
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return { success: false, error };
    }
  };

  const eliminarPedidoDefinitivo = async (pedidoId: string, motivo?: string) => {
    try {
      // 1) Cancelar todo (reponer stock de entregado y borrar detalle_pedidos) de forma atómica.
      const { data, error } = await supabase.rpc('cancelar_pedido_atomico', {
        p_pedido_id: pedidoId,
        p_usuario_id: null,
        p_items: null,
        p_motivo: motivo || 'ELIMINACION DEFINITIVA',
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Error al cancelar pedido antes de eliminar');
      }

      // 2) Borrar el pedido (definitivo). Si quedara algún detalle, FK debe cascade.
      const { error: delErr } = await supabase.from('pedidos').delete().eq('id', pedidoId);
      if (delErr) throw delErr;

      await fetchPedidos();
      return { success: true };
    } catch (error: any) {
      console.error('Error al eliminar pedido definitivamente:', error);
      return { success: false, error: error.message || error };
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    const onRefetch = () => {
      void fetchPedidos();
    };
    window.addEventListener(REFETCH_PEDIDOS_EVENT, onRefetch);
    return () => window.removeEventListener(REFETCH_PEDIDOS_EVENT, onRefetch);
  }, [fetchPedidos]);

  return {
    pedidos,
    loading,
    fetchPedidos,
    crearPedido,
    actualizarEstadoPedido,
    eliminarPedidoDefinitivo,
  };
}


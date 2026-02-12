'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Pedido {
  id: string;
  fecha: string;
  cliente_id: string;
  cliente_tipo: 'alumno' | 'externo';
  cliente_nombre: string;
  total: number;
  estado: 'PEDIDO' | 'ENTREGADO' | 'LIQUIDADO' | 'CANCELADO';
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

  const fetchPedidos = async () => {
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
  };

  const crearPedido = async (pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>, detalles: Omit<DetallePedido, 'id' | 'pedido_id'>[], pedido_sucursal_id?: string, usuario_id?: number | string) => {
    try {
      console.log('📦 Creando pedido con función atómica...', pedido);
      
      // Preparar detalles en formato JSONB para la función
      // CRÍTICO: Incluir cantidad_con_stock y cantidad_pendiente para división automática
      const detallesJsonb = detalles.map(det => ({
        prenda_id: det.prenda_id,
        talla_id: det.talla_id,
        cantidad: det.cantidad,
        cantidad_con_stock: (det as any).cantidad_con_stock || det.cantidad, // Cuánto tiene stock
        cantidad_pendiente: (det as any).cantidad_pendiente || 0, // Cuánto queda pendiente
        tiene_stock: (det as any).tiene_stock !== false, // Flag de disponibilidad
        especificaciones: det.especificaciones || ''
      }));

      // Obtener o generar UUID del usuario
      // Si viene un número (usuario_id de sesión legacy), usar UUID temporal
      // TODO: Migrar tabla usuarios para usar UUIDs
      const usuario_uuid = typeof usuario_id === 'string' 
        ? usuario_id 
        : '00000000-0000-0000-0000-000000000001'; // UUID temporal para usuarios legacy

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

  const actualizarEstadoPedido = async (id: string, nuevoEstado: Pedido['estado']) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', id);

      if (error) throw error;

      await fetchPedidos();
      return { success: true };
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [sucursal_id]);

  return {
    pedidos,
    loading,
    fetchPedidos,
    crearPedido,
    actualizarEstadoPedido,
  };
}


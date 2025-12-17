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
  efectivo_recibido: number;
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

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const crearPedido = async (pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>, detalles: Omit<DetallePedido, 'id' | 'pedido_id'>[]) => {
    try {
      // Insertar el pedido
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert([pedido])
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Insertar los detalles
      const detallesConPedidoId = detalles.map(detalle => ({
        ...detalle,
        pedido_id: pedidoData.id,
      }));

      const { error: detallesError } = await supabase
        .from('detalle_pedidos')
        .insert(detallesConPedidoId);

      if (detallesError) throw detallesError;

      // Actualizar stock de costos
      for (const detalle of detalles) {
        const { error: stockError } = await supabase.rpc('actualizar_stock_pedido', {
          p_prenda_id: detalle.prenda_id,
          p_talla_id: detalle.talla_id,
          p_cantidad: detalle.cantidad,
        });
        
        if (stockError) {
          console.error('Error al actualizar stock:', stockError);
        }
      }

      await fetchPedidos();
      return { success: true, data: pedidoData };
    } catch (error) {
      console.error('Error al crear pedido:', error);
      return { success: false, error };
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
  }, []);

  return {
    pedidos,
    loading,
    fetchPedidos,
    crearPedido,
    actualizarEstadoPedido,
  };
}


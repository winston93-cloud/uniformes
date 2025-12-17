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
      console.log('📦 Creando pedido...', pedido);
      
      // Preparar datos del pedido
      const pedidoData: any = {
        tipo_cliente: pedido.cliente_tipo,
        estado: pedido.estado,
        subtotal: pedido.total,
        total: pedido.total,
        cliente_nombre: pedido.cliente_nombre,
        // NO asignar alumno_id ni externo_id por ahora, solo usar tipo_cliente y cliente_nombre
        alumno_id: null,
        externo_id: null,
      };

      // Agregar campos opcionales solo si existen en la tabla
      if (pedido.observaciones) {
        pedidoData.notas = pedido.observaciones;
      }

      console.log('📝 Datos a insertar:', pedidoData);

      // Insertar el pedido
      const { data: pedidoInsertado, error: pedidoError } = await supabase
        .from('pedidos')
        .insert(pedidoData)
        .select()
        .single();

      if (pedidoError) {
        console.error('❌ Error al insertar pedido:', pedidoError);
        console.error('❌ Mensaje:', pedidoError.message);
        console.error('❌ Detalles:', pedidoError.details);
        console.error('❌ Hint:', pedidoError.hint);
        throw pedidoError;
      }

      console.log('✅ Pedido insertado:', pedidoInsertado);

      // Insertar los detalles
      const detallesConPedidoId = detalles.map(detalle => ({
        pedido_id: pedidoInsertado.id,
        prenda_id: detalle.prenda_id,
        talla_id: detalle.talla_id,
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: detalle.subtotal,
        pendiente: detalle.pendiente,
        especificaciones: detalle.especificaciones,
      }));

      const { error: detallesError } = await supabase
        .from('detalle_pedidos')
        .insert(detallesConPedidoId);

      if (detallesError) throw detallesError;

      // Actualizar stock de costos (restar la cantidad vendida)
      for (const detalle of detalles) {
        // Buscar el costo correspondiente
        const { data: costoData, error: costoError } = await supabase
          .from('costos')
          .select('stock')
          .eq('prenda_id', detalle.prenda_id)
          .eq('talla_id', detalle.talla_id)
          .single();

        if (costoError) {
          console.error('Error al buscar costo:', costoError);
          continue;
        }

        // Actualizar el stock
        const nuevoStock = (costoData.stock || 0) - detalle.cantidad;
        const { error: updateError } = await supabase
          .from('costos')
          .update({ stock: nuevoStock })
          .eq('prenda_id', detalle.prenda_id)
          .eq('talla_id', detalle.talla_id);

        if (updateError) {
          console.error('Error al actualizar stock:', updateError);
        }
      }

      await fetchPedidos();
      return { success: true, data: pedidoInsertado };
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


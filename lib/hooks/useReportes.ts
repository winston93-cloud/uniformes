'use client';

import { useState } from 'react';
import { supabase } from '../supabase';

export interface ReporteVentas {
  id: string;
  fecha: string;
  cliente: string;
  tipo_cliente: string;
  total: number;
}

export interface PrendaVendida {
  prenda: string;
  talla: string;
  cantidad: number;
  total: number;
}

export interface ClienteFrecuente {
  id: string;
  nombre: string;
  tipo: 'alumno' | 'externo';
  pedidos: number;
  total: number;
}

export function useReportes() {
  const [loading, setLoading] = useState(false);

  const ventasPorPeriodo = async (fechaInicio: string, fechaFin: string): Promise<ReporteVentas[]> => {
    try {
      setLoading(true);
      // Crear fechas en timezone local para evitar problemas de interpretación UTC
      const [yearInicio, mesInicio, diaInicio] = fechaInicio.split('-').map(Number);
      const fechaInicioObj = new Date(yearInicio, mesInicio - 1, diaInicio, 0, 0, 0, 0);
      
      const [yearFin, mesFin, diaFin] = fechaFin.split('-').map(Number);
      const fechaFinObj = new Date(yearFin, mesFin - 1, diaFin, 23, 59, 59, 999);

      // Obtener todos los pedidos liquidados con el nombre del cliente
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, created_at, total, fecha_liquidacion, tipo_cliente, cliente_nombre')
        .eq('estado', 'LIQUIDADO')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error obteniendo pedidos:', error);
        throw error;
      }

      // Filtrar por fecha (solo año-mes-día) y mapear a detalle individual
      const pedidosDetalle = data?.filter((pedido: any) => {
        const fechaPedido = new Date(pedido.fecha_liquidacion || pedido.created_at);
        
        // Comparar solo fechas (año, mes, día) sin horas para evitar problemas de timezone
        const fechaPedidoSolo = new Date(fechaPedido.getFullYear(), fechaPedido.getMonth(), fechaPedido.getDate());
        const fechaInicioSolo = new Date(fechaInicioObj.getFullYear(), fechaInicioObj.getMonth(), fechaInicioObj.getDate());
        const fechaFinSolo = new Date(fechaFinObj.getFullYear(), fechaFinObj.getMonth(), fechaFinObj.getDate());
        
        const incluido = fechaPedidoSolo >= fechaInicioSolo && fechaPedidoSolo <= fechaFinSolo;
        
        return incluido;
      }).map((pedido: any) => {
        const fechaPedido = new Date(pedido.fecha_liquidacion || pedido.created_at);
        
        return {
          id: pedido.id,
          fecha: fechaPedido.toISOString(),
          cliente: pedido.cliente_nombre || 'Sin cliente',
          tipo_cliente: pedido.tipo_cliente,
          total: parseFloat(pedido.total.toString()),
        };
      }) || [];

      return pedidosDetalle;
    } catch (err: any) {
      console.error('Error en ventasPorPeriodo:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const prendasMasVendidas = async (fechaInicio?: string, fechaFin?: string): Promise<PrendaVendida[]> => {
    try {
      setLoading(true);
      let query = supabase
        .from('detalle_pedidos')
        .select(`
          cantidad,
          subtotal,
          prenda:prendas(nombre),
          talla:tallas(nombre)
        `)
        .order('cantidad', { ascending: false })
        .limit(20);

      if (fechaInicio && fechaFin) {
        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('id')
          .eq('estado', 'LIQUIDADO')
          .gte('fecha_liquidacion', fechaInicio)
          .lte('fecha_liquidacion', fechaFin);

        if (pedidos && pedidos.length > 0) {
          const pedidoIds = pedidos.map(p => p.id);
          query = query.in('pedido_id', pedidoIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por prenda y talla
      const agrupados = new Map<string, PrendaVendida>();

      data?.forEach((detalle: any) => {
        const prendaNombre = detalle.prenda?.nombre || 'Sin nombre';
        const tallaNombre = detalle.talla?.nombre || 'Sin talla';
        const key = `${prendaNombre}-${tallaNombre}`;

        const existente = agrupados.get(key) || {
          prenda: prendaNombre,
          talla: tallaNombre,
          cantidad: 0,
          total: 0,
        };

        agrupados.set(key, {
          prenda: prendaNombre,
          talla: tallaNombre,
          cantidad: existente.cantidad + detalle.cantidad,
          total: existente.total + parseFloat(detalle.subtotal.toString()),
        });
      });

      return Array.from(agrupados.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);
    } catch (err: any) {
      console.error('Error en prendasMasVendidas:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const stockBajo = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('costos')
        .select(`
          *,
          prenda:prendas(nombre),
          talla:tallas(nombre)
        `)
        .eq('activo', true);

      if (error) throw error;

      // Filtrar en JavaScript donde stock <= 0 (sin stock)
      const stockBajoData = (data || []).filter((costo: any) => costo.stock <= 0);

      return stockBajoData;
    } catch (err: any) {
      console.error('Error en stockBajo:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const pedidosPendientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .in('estado', ['PEDIDO', 'ENTREGADO'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('Error en pedidosPendientes:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const clientesFrecuentes = async (): Promise<ClienteFrecuente[]> => {
    try {
      setLoading(true);
      
      // Obtener pedidos liquidados con nombre del cliente
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('cliente_nombre, tipo_cliente, total')
        .eq('estado', 'LIQUIDADO');

      if (error) throw error;

      // Agrupar por nombre de cliente
      const agrupados = new Map<string, ClienteFrecuente>();
      
      for (const pedido of pedidos || []) {
        const nombreCliente = pedido.cliente_nombre || 'Sin cliente';
        
        const existente = agrupados.get(nombreCliente) || {
          id: nombreCliente,
          nombre: nombreCliente,
          tipo: pedido.tipo_cliente as 'alumno' | 'externo',
          pedidos: 0,
          total: 0,
        };

        agrupados.set(nombreCliente, {
          ...existente,
          pedidos: existente.pedidos + 1,
          total: existente.total + parseFloat(pedido.total.toString()),
        });
      }

      return Array.from(agrupados.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    } catch (err: any) {
      console.error('Error en clientesFrecuentes:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const resumenGeneral = async () => {
    try {
      setLoading(true);
      
      const [
        { count: totalPedidos },
        { data: pedidosLiquidados },
        { count: totalAlumnos },
        { data: costos },
      ] = await Promise.all([
        supabase.from('pedidos').select('*', { count: 'exact', head: true }),
        supabase.from('pedidos').select('total').eq('estado', 'LIQUIDADO'),
        supabase.from('alumno').select('*', { count: 'exact', head: true }),
        supabase.from('costos').select('stock').eq('activo', true),
      ]);

      const ventasTotales = pedidosLiquidados?.reduce((sum, p) => sum + parseFloat(p.total.toString()), 0) || 0;
      const prendasStock = costos?.reduce((sum, c) => sum + c.stock, 0) || 0;

      return {
        totalPedidos: totalPedidos || 0,
        ventasTotales,
        totalAlumnos: totalAlumnos || 0,
        prendasStock,
      };
    } catch (err: any) {
      console.error('Error en resumenGeneral:', err);
      return {
        totalPedidos: 0,
        ventasTotales: 0,
        totalAlumnos: 0,
        prendasStock: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    ventasPorPeriodo,
    prendasMasVendidas,
    stockBajo,
    pedidosPendientes,
    clientesFrecuentes,
    resumenGeneral,
  };
}


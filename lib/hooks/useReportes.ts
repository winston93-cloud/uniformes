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
      const fechaInicioObj = new Date(fechaInicio);
      const fechaFinObj = new Date(fechaFin);
      fechaFinObj.setHours(23, 59, 59, 999);

      // Obtener todos los pedidos liquidados con información del cliente
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          alumno:alumno(nombre, referencia),
          externo:externos(nombre)
        `)
        .eq('estado', 'LIQUIDADO')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error en consulta Supabase:', error);
        throw error;
      }

      console.error('📊 DATOS DE PEDIDOS - Primer elemento:', JSON.stringify(data?.[0], null, 2));

      // Filtrar por fecha y mapear a detalle individual
      const pedidosDetalle = data?.filter((pedido: any) => {
        const fechaPedido = new Date(pedido.fecha_liquidacion || pedido.created_at);
        return fechaPedido >= fechaInicioObj && fechaPedido <= fechaFinObj;
      }).map((pedido: any) => {
        const fechaPedido = new Date(pedido.fecha_liquidacion || pedido.created_at);
        
        // Debug
        console.log('🔍 Pedido:', {
          tipo: pedido.tipo_cliente,
          alumno: pedido.alumno,
          externo: pedido.externo
        });
        
        const nombreCliente = pedido.tipo_cliente === 'alumno' 
          ? (pedido.alumno?.nombre || 'Alumno sin nombre')
          : (pedido.externo?.nombre || 'Cliente sin nombre');
        
        return {
          id: pedido.id,
          fecha: fechaPedido.toISOString(),
          cliente: nombreCliente,
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
          costo:costos(
            prenda:prendas(nombre),
            talla:tallas(nombre)
          )
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
        const prendaNombre = detalle.costo?.prenda?.nombre || 'Sin nombre';
        const tallaNombre = detalle.costo?.talla?.nombre || 'Sin talla';
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
        .select(`
          *,
          alumno:alumno(nombre, referencia),
          externo:externos(nombre)
        `)
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
      
      // Obtener pedidos liquidados
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('alumno_id, externo_id, tipo_cliente, total')
        .eq('estado', 'LIQUIDADO');

      if (error) throw error;

      // Agrupar primero por cliente
      const agrupadosTemp = new Map<string, { total: number; pedidos: number; tipo: string }>();
      
      for (const pedido of pedidos || []) {
        let clienteId: string;
        
        if (pedido.tipo_cliente === 'alumno' && pedido.alumno_id) {
          clienteId = pedido.alumno_id;
        } else if (pedido.tipo_cliente === 'externo' && pedido.externo_id) {
          clienteId = pedido.externo_id;
        } else {
          continue;
        }

        const existente = agrupadosTemp.get(clienteId) || {
          total: 0,
          pedidos: 0,
          tipo: pedido.tipo_cliente,
        };

        agrupadosTemp.set(clienteId, {
          ...existente,
          pedidos: existente.pedidos + 1,
          total: existente.total + parseFloat(pedido.total.toString()),
        });
      }

      // Ahora obtener nombres de clientes
      const alumnosIds = Array.from(agrupadosTemp.entries())
        .filter(([_, data]) => data.tipo === 'alumno')
        .map(([id]) => id);

      const externosIds = Array.from(agrupadosTemp.entries())
        .filter(([_, data]) => data.tipo === 'externo')
        .map(([id]) => id);

      const nombresClientes = new Map<string, string>();

      if (alumnosIds.length > 0) {
        // Intentar buscar por alumno_ref primero (por si es texto)
        const { data: alumnos } = await supabase
          .from('alumno')
          .select('alumno_id, alumno_nombre_completo, alumno_ref')
          .in('alumno_ref', alumnosIds);

        alumnos?.forEach((alumno: any) => {
          nombresClientes.set(alumno.alumno_ref, alumno.alumno_nombre_completo || `Alumno ${alumno.alumno_ref}`);
        });

        // Si no se encontraron, intentar por alumno_id (por si es número)
        const idsNumericos = alumnosIds.filter(id => !isNaN(Number(id)));
        if (idsNumericos.length > 0) {
          const { data: alumnosPorId } = await supabase
            .from('alumno')
            .select('alumno_id, alumno_nombre_completo, alumno_ref')
            .in('alumno_id', idsNumericos.map(id => parseInt(id)));

          alumnosPorId?.forEach((alumno: any) => {
            const key = String(alumno.alumno_id);
            if (!nombresClientes.has(key)) {
              nombresClientes.set(key, alumno.alumno_nombre_completo || `Alumno ${alumno.alumno_ref}`);
            }
          });
        }
      }

      if (externosIds.length > 0) {
        const { data: externos } = await supabase
          .from('externos')
          .select('id, nombre')
          .in('id', externosIds);

        externos?.forEach((externo: any) => {
          nombresClientes.set(externo.id, externo.nombre || 'Cliente Externo');
        });
      }

      // Construir resultado final
      const agrupados = new Map<string, ClienteFrecuente>();

      if (error) throw error;

      for (const [clienteId, datos] of agrupadosTemp.entries()) {
        const nombre = nombresClientes.get(clienteId) || `Cliente ${clienteId}`;
        
        agrupados.set(clienteId, {
          id: clienteId,
          nombre,
          tipo: datos.tipo as 'alumno' | 'externo',
          pedidos: datos.pedidos,
          total: datos.total,
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


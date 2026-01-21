'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface InsumoFaltante {
  insumo_id: string;
  insumo_nombre: string;
  insumo_codigo: string;
  cantidad_necesaria: number;
  presentacion_nombre: string;
  presentacion_descripcion: string;
}

export function useInsumosFaltantes() {
  const [insumosFaltantes, setInsumosFaltantes] = useState<InsumoFaltante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerInsumosFaltantes();
  }, []);

  async function obtenerInsumosFaltantes() {
    try {
      setCargando(true);
      setError(null);

      // 1. Obtener todos los pedidos en estado "PEDIDO" (no entregados)
      const { data: pedidosPendientes, error: errorPedidos } = await supabase
        .from('pedidos')
        .select('id')
        .eq('estado', 'PEDIDO');

      if (errorPedidos) throw errorPedidos;
      if (!pedidosPendientes || pedidosPendientes.length === 0) {
        setInsumosFaltantes([]);
        setCargando(false);
        return;
      }

      const pedidosIds = pedidosPendientes.map((p) => p.id);

      // 2. Obtener todos los detalles de esos pedidos (qué prendas-tallas se vendieron)
      const { data: detallesPedidos, error: errorDetalles } = await supabase
        .from('detalle_pedidos')
        .select(`
          cantidad,
          costo_id,
          costos!inner (
            prenda_id,
            talla_id,
            prendas!inner (
              id,
              nombre
            ),
            tallas!inner (
              id,
              nombre
            )
          )
        `)
        .in('pedido_id', pedidosIds);

      if (errorDetalles) throw errorDetalles;
      if (!detallesPedidos || detallesPedidos.length === 0) {
        setInsumosFaltantes([]);
        setCargando(false);
        return;
      }

      // 3. Por cada prenda-talla vendida, obtener sus insumos y calcular cantidad total necesaria
      const insumosMap = new Map<string, InsumoFaltante>();

      for (const detalle of detallesPedidos) {
        if (!detalle.costos) continue;

        const prenda_id = detalle.costos.prenda_id;
        const talla_id = detalle.costos.talla_id;
        const cantidad_prendas = detalle.cantidad;

        // Obtener los insumos para esta combinación prenda-talla
        const { data: insumosPrenda, error: errorInsumos } = await supabase
          .from('prenda_talla_insumos')
          .select(`
            cantidad,
            insumo_id,
            insumos!inner (
              id,
              nombre,
              codigo,
              presentacion_id,
              presentaciones!inner (
                nombre,
                descripcion
              )
            )
          `)
          .eq('prenda_id', prenda_id)
          .eq('talla_id', talla_id);

        if (errorInsumos) throw errorInsumos;
        if (!insumosPrenda) continue;

        // Acumular cantidades por insumo
        for (const insumoItem of insumosPrenda) {
          if (!insumoItem.insumos) continue;

          const insumo = insumoItem.insumos;
          const cantidad_por_prenda = insumoItem.cantidad;
          const cantidad_total = cantidad_por_prenda * cantidad_prendas;

          const key = insumo.id;

          if (insumosMap.has(key)) {
            const existing = insumosMap.get(key)!;
            existing.cantidad_necesaria += cantidad_total;
          } else {
            insumosMap.set(key, {
              insumo_id: insumo.id,
              insumo_nombre: insumo.nombre,
              insumo_codigo: insumo.codigo,
              cantidad_necesaria: cantidad_total,
              presentacion_nombre: insumo.presentaciones?.nombre || 'unidad',
              presentacion_descripcion: insumo.presentaciones?.descripcion || '',
            });
          }
        }
      }

      // Convertir el Map a array y ordenar por cantidad descendente
      const resultado = Array.from(insumosMap.values()).sort(
        (a, b) => b.cantidad_necesaria - a.cantidad_necesaria
      );

      setInsumosFaltantes(resultado);
    } catch (err) {
      console.error('Error al obtener insumos faltantes:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  return {
    insumosFaltantes,
    cargando,
    error,
    recargar: obtenerInsumosFaltantes,
  };
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface InsumoFaltante {
  insumo_id: string;
  insumo_nombre: string;
  insumo_codigo: string;
  cantidad_necesaria: number;
  cantidad_comprada: number;
  cantidad_faltante: number;
  porcentaje_completado: number;
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
        // TypeScript trata las relaciones como arrays, accedemos al primer elemento
        const costo = Array.isArray(detalle.costos) ? detalle.costos[0] : detalle.costos;
        if (!costo) continue;

        const prenda_id = costo.prenda_id;
        const talla_id = costo.talla_id;
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
          // TypeScript trata las relaciones como arrays, accedemos al primer elemento
          const insumo = Array.isArray(insumoItem.insumos) ? insumoItem.insumos[0] : insumoItem.insumos;
          if (!insumo) continue;

          const presentacion = Array.isArray(insumo.presentaciones) ? insumo.presentaciones[0] : insumo.presentaciones;

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
              cantidad_comprada: 0,
              cantidad_faltante: 0,
              porcentaje_completado: 0,
              presentacion_nombre: presentacion?.nombre || 'unidad',
              presentacion_descripcion: presentacion?.descripcion || '',
            });
          }
        }
      }

      // Obtener cantidades compradas de cada insumo
      const insumosConCompras = await Promise.all(
        Array.from(insumosMap.values()).map(async (insumo) => {
          const { data: compras } = await supabase
            .from('compras_insumos')
            .select('cantidad_comprada')
            .eq('insumo_id', insumo.insumo_id);

          const cantidad_comprada = (compras || []).reduce(
            (sum, compra) => sum + (compra.cantidad_comprada || 0),
            0
          );

          const cantidad_faltante = Math.max(0, insumo.cantidad_necesaria - cantidad_comprada);
          const porcentaje_completado = insumo.cantidad_necesaria > 0
            ? Math.round((cantidad_comprada / insumo.cantidad_necesaria) * 100)
            : 0;

          return {
            ...insumo,
            cantidad_comprada,
            cantidad_faltante,
            porcentaje_completado,
          };
        })
      );

      // Ordenar por cantidad faltante descendente (los más urgentes primero)
      const resultado = insumosConCompras.sort(
        (a, b) => b.cantidad_faltante - a.cantidad_faltante
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

'use client';

import { useState, useEffect } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { selectTodo } from '@/lib/selectTodo';

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

      // 1. Obtener todos los pedidos en estado "PENDIENTE" (no entregados)
      const { data: pedidosPendientes, error: errorPedidos } = await selectTodo((desde, hasta) =>
        insforgeDb().from('pedidos').select('id').eq('estado', 'PENDIENTE').order('id').range(desde, hasta)
      );

      if (errorPedidos) throw errorPedidos;
      if (pedidosPendientes.length === 0) {
        setInsumosFaltantes([]);
        setCargando(false);
        return;
      }

      const pedidosIds = pedidosPendientes.map((p) => p.id as string);

      // 2. Detalles de esos pedidos (qué prendas-tallas se vendieron). El gateway de InsForge responde 502 sin CORS
      // (el navegador lo ve como "Failed to fetch") cuando la URL pasa de ~3 KB: unos 80 UUID en el filtro in().
      const detallesPedidos: { cantidad: number; prenda_id: string | null; talla_id: string | null; costos: unknown }[] = [];
      for (let i = 0; i < pedidosIds.length; i += 40) {
        const lote = pedidosIds.slice(i, i + 40);
        const { data, error: errorDetalles } = await selectTodo((desde, hasta) =>
          insforgeDb()
            .from('detalle_pedidos')
            .select('id, cantidad, prenda_id, talla_id, costos ( prenda_id, talla_id )')
            .in('pedido_id', lote)
            .order('id')
            .range(desde, hasta)
        );
        if (errorDetalles) throw errorDetalles;
        detallesPedidos.push(...(data as typeof detallesPedidos));
      }

      if (detallesPedidos.length === 0) {
        setInsumosFaltantes([]);
        setCargando(false);
        return;
      }

      // 3. Recetas de insumos por prenda-talla, todas en una sola lectura
      const { data: recetas, error: errorInsumos } = await selectTodo((desde, hasta) =>
        insforgeDb()
          .from('prenda_talla_insumos')
          .select(`
            id,
            prenda_id,
            talla_id,
            cantidad,
            insumo_id,
            insumos (
              id,
              nombre,
              codigo,
              presentacion_id,
              presentaciones (
                nombre,
                descripcion
              )
            )
          `)
          .order('id')
          .range(desde, hasta)
      );

      if (errorInsumos) throw errorInsumos;

      const recetasPorPrendaTalla = new Map<string, typeof recetas>();
      for (const r of recetas) {
        const clave = `${r.prenda_id}|${r.talla_id}`;
        const lista = recetasPorPrendaTalla.get(clave);
        if (lista) lista.push(r);
        else recetasPorPrendaTalla.set(clave, [r]);
      }

      // 4. Por cada prenda-talla vendida, acumular la cantidad total necesaria de cada insumo
      const insumosMap = new Map<string, InsumoFaltante>();

      for (const detalle of detallesPedidos) {
        // TypeScript trata las relaciones como arrays, accedemos al primer elemento
        const costo = (Array.isArray(detalle.costos) ? detalle.costos[0] : detalle.costos) as
          | { prenda_id: string | null; talla_id: string | null }
          | null;

        const prenda_id = costo?.prenda_id ?? detalle.prenda_id;
        const talla_id = costo?.talla_id ?? detalle.talla_id;
        if (!prenda_id || !talla_id) continue;
        const cantidad_prendas = detalle.cantidad;

        const insumosPrenda = recetasPorPrendaTalla.get(`${prenda_id}|${talla_id}`);
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

      // Cantidades compradas de cada insumo, en una sola lectura
      const { data: compras, error: errorCompras } = await selectTodo((desde, hasta) =>
        insforgeDb().from('compras_insumos').select('id, insumo_id, cantidad_comprada').order('id').range(desde, hasta)
      );
      if (errorCompras) throw errorCompras;

      const compradoPorInsumo = new Map<string, number>();
      for (const compra of compras) {
        compradoPorInsumo.set(
          compra.insumo_id,
          (compradoPorInsumo.get(compra.insumo_id) ?? 0) + (compra.cantidad_comprada || 0)
        );
      }

      const insumosConCompras = Array.from(insumosMap.values()).map((insumo) => {
          const cantidad_comprada = compradoPorInsumo.get(insumo.insumo_id) ?? 0;

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
        });

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

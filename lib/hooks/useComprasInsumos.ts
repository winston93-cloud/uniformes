'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface CompraInsumo {
  id: string;
  insumo_id: string;
  cantidad_comprada: number;
  costo_unitario: number | null;
  costo_total: number | null;
  proveedor: string | null;
  fecha_compra: string;
  notas: string | null;
  usuario_id: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  insumo?: {
    id: string;
    codigo: string;
    nombre: string;
    presentacion?: {
      nombre: string;
      descripcion: string;
    };
  };
}

export interface NuevaCompraInsumo {
  insumo_id: string;
  cantidad_comprada: number;
  costo_unitario?: number;
  costo_total?: number;
  proveedor?: string;
  fecha_compra?: string;
  notas?: string;
}

export function useComprasInsumos(insumo_id?: string) {
  const [compras, setCompras] = useState<CompraInsumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (insumo_id) {
      obtenerComprasPorInsumo(insumo_id);
    } else {
      obtenerTodasCompras();
    }
  }, [insumo_id]);

  async function obtenerTodasCompras() {
    try {
      setCargando(true);
      setError(null);

      const { data, error: errorCompras } = await supabase
        .from('compras_insumos')
        .select(`
          *,
          insumo:insumos!inner (
            id,
            codigo,
            nombre,
            presentacion:presentaciones!inner (
              nombre,
              descripcion
            )
          )
        `)
        .order('fecha_compra', { ascending: false });

      if (errorCompras) throw errorCompras;

      // Procesar datos para manejar arrays
      const comprasProcesadas = (data || []).map((compra: any) => ({
        ...compra,
        insumo: Array.isArray(compra.insumo) ? compra.insumo[0] : compra.insumo,
      }));

      setCompras(comprasProcesadas);
    } catch (err) {
      console.error('Error al obtener compras:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  async function obtenerComprasPorInsumo(insumoId: string) {
    try {
      setCargando(true);
      setError(null);

      const { data, error: errorCompras } = await supabase
        .from('compras_insumos')
        .select(`
          *,
          insumo:insumos!inner (
            id,
            codigo,
            nombre,
            presentacion:presentaciones!inner (
              nombre,
              descripcion
            )
          )
        `)
        .eq('insumo_id', insumoId)
        .order('fecha_compra', { ascending: false });

      if (errorCompras) throw errorCompras;

      // Procesar datos para manejar arrays
      const comprasProcesadas = (data || []).map((compra: any) => ({
        ...compra,
        insumo: Array.isArray(compra.insumo) ? compra.insumo[0] : compra.insumo,
      }));

      setCompras(comprasProcesadas);
    } catch (err) {
      console.error('Error al obtener compras por insumo:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  async function crearCompra(nuevaCompra: NuevaCompraInsumo): Promise<boolean> {
    try {
      setError(null);

      // Calcular costo_total si no se proporciona
      const costoTotal = nuevaCompra.costo_total || 
        (nuevaCompra.costo_unitario 
          ? nuevaCompra.cantidad_comprada * nuevaCompra.costo_unitario 
          : null);

      const { error: errorCrear } = await supabase
        .from('compras_insumos')
        .insert({
          ...nuevaCompra,
          costo_total: costoTotal,
        });

      if (errorCrear) throw errorCrear;

      // Recargar compras
      if (insumo_id) {
        await obtenerComprasPorInsumo(insumo_id);
      } else {
        await obtenerTodasCompras();
      }

      return true;
    } catch (err) {
      console.error('Error al crear compra:', err);
      setError(err instanceof Error ? err.message : 'Error al crear compra');
      return false;
    }
  }

  async function actualizarCompra(
    id: string, 
    datosActualizados: Partial<NuevaCompraInsumo>
  ): Promise<boolean> {
    try {
      setError(null);

      // Recalcular costo_total si se modifican cantidad o costo_unitario
      const compraActual = compras.find(c => c.id === id);
      if (!compraActual) {
        throw new Error('Compra no encontrada');
      }

      const cantidadFinal = datosActualizados.cantidad_comprada ?? compraActual.cantidad_comprada;
      const costoUnitarioFinal = datosActualizados.costo_unitario ?? compraActual.costo_unitario;

      const costoTotal = datosActualizados.costo_total ||
        (costoUnitarioFinal 
          ? cantidadFinal * costoUnitarioFinal 
          : null);

      const { error: errorActualizar } = await supabase
        .from('compras_insumos')
        .update({
          ...datosActualizados,
          costo_total: costoTotal,
        })
        .eq('id', id);

      if (errorActualizar) throw errorActualizar;

      // Recargar compras
      if (insumo_id) {
        await obtenerComprasPorInsumo(insumo_id);
      } else {
        await obtenerTodasCompras();
      }

      return true;
    } catch (err) {
      console.error('Error al actualizar compra:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar compra');
      return false;
    }
  }

  async function eliminarCompra(id: string): Promise<boolean> {
    try {
      setError(null);

      const { error: errorEliminar } = await supabase
        .from('compras_insumos')
        .delete()
        .eq('id', id);

      if (errorEliminar) throw errorEliminar;

      // Recargar compras
      if (insumo_id) {
        await obtenerComprasPorInsumo(insumo_id);
      } else {
        await obtenerTodasCompras();
      }

      return true;
    } catch (err) {
      console.error('Error al eliminar compra:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar compra');
      return false;
    }
  }

  async function obtenerTotalCompradoPorInsumo(insumoId: string): Promise<number> {
    try {
      const { data, error: errorTotal } = await supabase
        .from('compras_insumos')
        .select('cantidad_comprada')
        .eq('insumo_id', insumoId);

      if (errorTotal) throw errorTotal;

      const total = (data || []).reduce(
        (sum, compra) => sum + (compra.cantidad_comprada || 0), 
        0
      );

      return total;
    } catch (err) {
      console.error('Error al obtener total comprado:', err);
      return 0;
    }
  }

  return {
    compras,
    cargando,
    error,
    crearCompra,
    actualizarCompra,
    eliminarCompra,
    obtenerTotalCompradoPorInsumo,
    recargar: insumo_id ? () => obtenerComprasPorInsumo(insumo_id) : obtenerTodasCompras,
  };
}

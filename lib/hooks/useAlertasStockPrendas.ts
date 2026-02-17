'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AlertaStockPrenda {
  costo_id: string;
  prenda_nombre: string;
  prenda_codigo: string;
  talla_nombre: string;
  stock_actual: number;
  stock_minimo: number;
  diferencia: number; // stock_actual - stock_minimo (negativo = crítico)
  porcentaje_stock: number; // (stock_actual / stock_minimo) * 100
  nivel_alerta: 'critico' | 'bajo' | 'advertencia'; // <25% = crítico, 25-50% = bajo, 50-100% = advertencia
  precio_mayoreo: number;
  precio_menudeo: number;
}

export function useAlertasStockPrendas(sucursal_id?: string) {
  const [alertas, setAlertas] = useState<AlertaStockPrenda[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarAlertas = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      // Obtener todos los costos (prenda-talla) con stock mínimo definido
      let query = supabase
        .from('costos')
        .select(`
          id,
          stock,
          stock_minimo,
          precio_mayoreo,
          precio_menudeo,
          prendas!inner (
            nombre,
            codigo
          ),
          tallas!inner (
            nombre
          )
        `)
        .gt('stock_minimo', 0) // Solo prendas con stock mínimo definido
        .eq('activo', true) // Solo prendas activas
        .order('stock', { ascending: true }); // Las más críticas primero

      // Filtrar por sucursal si se proporciona
      if (sucursal_id) {
        query = query.eq('sucursal_id', sucursal_id);
      }

      const { data: costosData, error: costosError } = await query;

      if (costosError) throw costosError;
      if (!costosData || costosData.length === 0) {
        setAlertas([]);
        return;
      }

      // Crear alertas para prendas con stock bajo o crítico
      const alertasCalculadas: AlertaStockPrenda[] = [];

      for (const costo of costosData) {
        const prenda = Array.isArray(costo.prendas) ? costo.prendas[0] : costo.prendas;
        const talla = Array.isArray(costo.tallas) ? costo.tallas[0] : costo.tallas;

        const stockActual = costo.stock || 0;
        const stockMinimo = costo.stock_minimo || 0;
        const diferencia = stockActual - stockMinimo;
        const porcentajeStock = stockMinimo > 0 
          ? Math.round((stockActual / stockMinimo) * 100) 
          : 100;

        // Solo incluir prendas que están por debajo o cerca del stock mínimo
        if (porcentajeStock <= 100) {
          let nivelAlerta: 'critico' | 'bajo' | 'advertencia';
          
          if (porcentajeStock < 25) {
            nivelAlerta = 'critico';
          } else if (porcentajeStock < 50) {
            nivelAlerta = 'bajo';
          } else {
            nivelAlerta = 'advertencia';
          }

          alertasCalculadas.push({
            costo_id: costo.id,
            prenda_nombre: prenda?.nombre || 'Sin nombre',
            prenda_codigo: prenda?.codigo || 'N/A',
            talla_nombre: talla?.nombre || 'N/A',
            stock_actual: stockActual,
            stock_minimo: stockMinimo,
            diferencia,
            porcentaje_stock: porcentajeStock,
            nivel_alerta: nivelAlerta,
            precio_mayoreo: costo.precio_mayoreo,
            precio_menudeo: costo.precio_menudeo,
          });
        }
      }

      // Ordenar por nivel de alerta (crítico primero) y luego por porcentaje
      alertasCalculadas.sort((a, b) => {
        const ordenNivel = { critico: 0, bajo: 1, advertencia: 2 };
        const nivelDiff = ordenNivel[a.nivel_alerta] - ordenNivel[b.nivel_alerta];
        if (nivelDiff !== 0) return nivelDiff;
        return a.porcentaje_stock - b.porcentaje_stock;
      });

      setAlertas(alertasCalculadas);
    } catch (err) {
      console.error('Error al cargar alertas de stock de prendas:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setAlertas([]);
    } finally {
      setCargando(false);
    }
  }, [sucursal_id]);

  useEffect(() => {
    cargarAlertas();
  }, [cargarAlertas]);

  const recargar = useCallback(() => {
    cargarAlertas();
  }, [cargarAlertas]);

  // Contadores por nivel
  const contadores = {
    critico: alertas.filter(a => a.nivel_alerta === 'critico').length,
    bajo: alertas.filter(a => a.nivel_alerta === 'bajo').length,
    advertencia: alertas.filter(a => a.nivel_alerta === 'advertencia').length,
    total: alertas.length,
  };

  return {
    alertas,
    cargando,
    error,
    recargar,
    contadores,
  };
}

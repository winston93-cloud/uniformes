'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AlertaStock {
  insumo_id: string;
  insumo_nombre: string;
  insumo_codigo: string;
  stock_actual: number;
  stock_minimo: number;
  diferencia: number; // stock_actual - stock_minimo (negativo = crítico)
  porcentaje_stock: number; // (stock_actual / stock_minimo) * 100
  nivel_alerta: 'critico' | 'bajo' | 'advertencia'; // <25% = crítico, 25-50% = bajo, 50-100% = advertencia
  presentacion_nombre: string;
  presentacion_descripcion: string;
}

export function useAlertasStock() {
  const [alertas, setAlertas] = useState<AlertaStock[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarAlertas = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      // 1. Obtener todos los insumos con su stock mínimo
      const { data: insumosData, error: insumosError } = await supabase
        .from('insumos')
        .select(`
          id,
          nombre,
          codigo,
          stock_minimo,
          presentaciones!inner (
            nombre,
            descripcion
          )
        `)
        .gt('stock_minimo', 0) // Solo insumos con stock mínimo definido
        .order('nombre');

      if (insumosError) throw insumosError;
      if (!insumosData || insumosData.length === 0) {
        setAlertas([]);
        return;
      }

      // 2. Obtener todas las compras de insumos
      const { data: comprasData, error: comprasError } = await supabase
        .from('compras_insumos')
        .select('insumo_id, cantidad_comprada');

      if (comprasError) throw comprasError;

      // 3. Calcular stock actual por insumo
      const stockPorInsumo = new Map<string, number>();
      
      if (comprasData) {
        for (const compra of comprasData) {
          const stockActual = stockPorInsumo.get(compra.insumo_id) || 0;
          stockPorInsumo.set(compra.insumo_id, stockActual + compra.cantidad_comprada);
        }
      }

      // 4. Crear alertas para insumos con stock bajo o crítico
      const alertasCalculadas: AlertaStock[] = [];

      for (const insumo of insumosData) {
        const presentacion = Array.isArray(insumo.presentaciones) 
          ? insumo.presentaciones[0] 
          : insumo.presentaciones;

        const stockActual = stockPorInsumo.get(insumo.id) || 0;
        const stockMinimo = insumo.stock_minimo || 0;
        const diferencia = stockActual - stockMinimo;
        const porcentajeStock = stockMinimo > 0 
          ? Math.round((stockActual / stockMinimo) * 100) 
          : 100;

        // Solo incluir insumos que están por debajo o cerca del stock mínimo
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
            insumo_id: insumo.id,
            insumo_nombre: insumo.nombre,
            insumo_codigo: insumo.codigo,
            stock_actual: stockActual,
            stock_minimo: stockMinimo,
            diferencia,
            porcentaje_stock: porcentajeStock,
            nivel_alerta: nivelAlerta,
            presentacion_nombre: presentacion?.nombre || 'unidad',
            presentacion_descripcion: presentacion?.descripcion || '',
          });
        }
      }

      // 5. Ordenar por nivel de alerta (crítico primero) y luego por porcentaje
      alertasCalculadas.sort((a, b) => {
        const ordenNivel = { critico: 0, bajo: 1, advertencia: 2 };
        const nivelDiff = ordenNivel[a.nivel_alerta] - ordenNivel[b.nivel_alerta];
        if (nivelDiff !== 0) return nivelDiff;
        return a.porcentaje_stock - b.porcentaje_stock;
      });

      setAlertas(alertasCalculadas);
    } catch (err) {
      console.error('Error al cargar alertas de stock:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setAlertas([]);
    } finally {
      setCargando(false);
    }
  }, []);

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

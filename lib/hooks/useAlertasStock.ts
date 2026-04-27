'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseErrorMessage, supabase } from '@/lib/supabase';

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

      // 1. Insumos sin embed (InsForge puede devolver 400 con presentaciones(...))
      const { data: insumosData, error: insumosError } = await supabase
        .from('insumos')
        .select('id, nombre, codigo, stock_minimo, presentacion_id')
        .gt('stock_minimo', 0)
        .order('nombre');

      if (insumosError) throw insumosError;
      if (!insumosData || insumosData.length === 0) {
        setAlertas([]);
        return;
      }

      const presIds = [
        ...new Set(
          insumosData
            .map((i) => {
              const x = i as Record<string, unknown>;
              return (x.presentacion_id ?? x.presentacionId) as string | null | undefined;
            })
            .filter(Boolean)
        ),
      ] as string[];
      let presById = new Map<string, { nombre: string; descripcion?: string | null }>();
      if (presIds.length > 0) {
        const { data: presRows, error: presErr } = await supabase
          .from('presentaciones')
          .select('id, nombre, descripcion')
          .in('id', presIds);
        if (presErr) throw presErr;
        presById = new Map(
          (presRows || []).map((p) => [
            String((p as { id: string }).id),
            {
              nombre: String((p as { nombre?: string }).nombre ?? ''),
              descripcion: (p as { descripcion?: string | null }).descripcion ?? null,
            },
          ])
        );
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
          const r = compra as Record<string, unknown>;
          const insumoId = String(r.insumo_id ?? r.insumoId ?? '');
          const cant = Number(r.cantidad_comprada ?? r.cantidadComprada ?? 0) || 0;
          if (!insumoId) continue;
          const stockActual = stockPorInsumo.get(insumoId) || 0;
          stockPorInsumo.set(insumoId, stockActual + cant);
        }
      }

      // 4. Crear alertas para insumos con stock bajo o crítico
      const alertasCalculadas: AlertaStock[] = [];

      for (const insumo of insumosData) {
        const rawIn = insumo as Record<string, unknown>;
        const row = insumo as {
          id: string;
          nombre: string;
          codigo: string | null;
          stock_minimo: number | null;
          presentacion_id?: string | null;
        };
        const pid = (rawIn.presentacion_id ?? rawIn.presentacionId) as string | null | undefined;
        const presentacion = pid ? presById.get(String(pid)) : undefined;

        const stockActual = stockPorInsumo.get(row.id) || 0;
        const stockMinimo = row.stock_minimo || 0;
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
            insumo_id: row.id,
            insumo_nombre: row.nombre,
            insumo_codigo: row.codigo || '',
            stock_actual: stockActual,
            stock_minimo: stockMinimo,
            diferencia,
            porcentaje_stock: porcentajeStock,
            nivel_alerta: nivelAlerta,
            presentacion_nombre: presentacion?.nombre || 'unidad',
            presentacion_descripcion: presentacion?.descripcion ?? '',
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
      setError(getSupabaseErrorMessage(err));
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

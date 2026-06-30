'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseErrorMessage } from '@/lib/supabase';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { filtrarCostosInventarioTienda } from '@/lib/inventarioSucursal';

function readFk(row: Record<string, unknown>, snake: string, camel: string): string | null {
  const v = row[snake] ?? row[camel];
  if (v == null || v === '') return null;
  return String(v);
}

function normId(id: string): string {
  return id.trim().toLowerCase();
}

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

export function useAlertasStockPrendas(sucursal_id?: string, es_matriz?: boolean) {
  const [alertas, setAlertas] = useState<AlertaStockPrenda[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarAlertas = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      // Nunca .eq('sucursal_id') en URL: en InsForge a veces no existe la columna (400).
      const { data: costosRaw, error: costosError } = await insforgeDb().from('costos').select('*');

      if (costosError) throw costosError;

      let costosData = filtrarCostosInventarioTienda(
        (costosRaw || []) as Record<string, unknown>[],
        { sucursalId: sucursal_id, esMatriz: es_matriz }
      );

      costosData = costosData.filter((row) => {
        const r = row as Record<string, unknown>;
        const sm = Number(r.stock_minimo ?? r.stockMinimo ?? 0);
        const act = r.activo ?? r.activo;
        return sm > 0 && act !== false;
      });
      costosData.sort(
        (a, b) =>
          Number((a as { stock?: unknown }).stock ?? 0) - Number((b as { stock?: unknown }).stock ?? 0)
      );

      if (!costosData.length) {
        setAlertas([]);
        return;
      }

      const prendaIds = [...new Set(costosData.map((c) => readFk(c as Record<string, unknown>, 'prenda_id', 'prendaId')).filter(Boolean))] as string[];
      const tallaIds = [...new Set(costosData.map((c) => readFk(c as Record<string, unknown>, 'talla_id', 'tallaId')).filter(Boolean))] as string[];

      const [preRes, taRes] = await Promise.all([
        prendaIds.length > 0
          ? insforgeDb().from('prendas').select('id, nombre, codigo').in('id', prendaIds)
          : Promise.resolve({ data: [] as unknown[] }),
        tallaIds.length > 0
          ? insforgeDb().from('tallas').select('id, nombre').in('id', tallaIds)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);
      if ('error' in preRes && preRes.error) throw preRes.error;
      if ('error' in taRes && taRes.error) throw taRes.error;

      const prendaPorId = new Map(
        (preRes.data || []).map((p) => {
          const r = p as { id: string; nombre?: string; codigo?: string | null };
          return [normId(String(r.id)), { nombre: r.nombre ?? '', codigo: r.codigo ?? null }] as const;
        })
      );
      const tallaPorId = new Map(
        (taRes.data || []).map((t) => {
          const r = t as { id: string; nombre?: string };
          return [normId(String(r.id)), r.nombre ?? ''] as const;
        })
      );

      const alertasCalculadas: AlertaStockPrenda[] = [];

      for (const costo of costosData) {
        const cr = costo as Record<string, unknown>;
        const prendaId = readFk(cr, 'prenda_id', 'prendaId');
        const tallaId = readFk(cr, 'talla_id', 'tallaId');
        const prenda = prendaId ? prendaPorId.get(normId(prendaId)) : undefined;
        const tallaNombre = tallaId ? tallaPorId.get(normId(tallaId)) : undefined;

        const stockActual = Number(cr.stock ?? 0) || 0;
        const stockMinimo = Number(cr.stock_minimo ?? cr.stockMinimo ?? 0) || 0;
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
            costo_id: String(cr.id ?? ''),
            prenda_nombre: prenda?.nombre || 'Sin nombre',
            prenda_codigo: prenda?.codigo ?? 'N/A',
            talla_nombre: tallaNombre || 'N/A',
            stock_actual: stockActual,
            stock_minimo: stockMinimo,
            diferencia,
            porcentaje_stock: porcentajeStock,
            nivel_alerta: nivelAlerta,
            precio_mayoreo: Number(cr.precio_mayoreo ?? 0),
            precio_menudeo: Number(cr.precio_menudeo ?? 0),
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
      setError(getSupabaseErrorMessage(err));
      setAlertas([]);
    } finally {
      setCargando(false);
    }
  }, [sucursal_id, es_matriz]);

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

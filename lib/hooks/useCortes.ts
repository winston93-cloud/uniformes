'use client';

import { useState, useEffect, useCallback } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Corte } from '../types';

function readSucursalId(row: Record<string, unknown>): string {
  const v = row.sucursal_id ?? row.sucursalId;
  return v != null ? String(v).trim() : '';
}

export function useCortes(sucursal_id?: string) {
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCortes = useCallback(async () => {
    try {
      setLoading(true);
      if (!sucursal_id?.trim()) {
        setCortes([]);
        setError(null);
        return;
      }

      const { data, error: qErr } = await insforgeDb()
        .from('cortes')
        .select('*')
        .eq('sucursal_id', sucursal_id.trim())
        .order('fecha', { ascending: false });

      if (qErr) throw qErr;
      setCortes((data || []) as Corte[]);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('Error fetching cortes:', err);
    } finally {
      setLoading(false);
    }
  }, [sucursal_id]);

  useEffect(() => {
    void fetchCortes();
  }, [fetchCortes]);

  const crearCorte = async (fechaInicio: string, fechaFin: string) => {
    if (!sucursal_id?.trim()) {
      return { data: null, error: 'No hay sucursal activa en la sesión.' };
    }

    try {
      const sid = sucursal_id.trim();
      const fechaInicioObj = new Date(fechaInicio + 'T00:00:00');
      const fechaFinObj = new Date(fechaFin + 'T23:59:59');

      const { data: pedidos, error: pedidosError } = await insforgeDb()
        .from('pedidos')
        .select('id, total, estado, sucursal_id')
        .eq('estado', 'COMPLETADO')
        .eq('sucursal_id', sid)
        .gte('created_at', fechaInicioObj.toISOString())
        .lte('created_at', fechaFinObj.toISOString());

      if (pedidosError) throw pedidosError;

      const totalVentas = pedidos?.reduce((sum, p) => sum + parseFloat(String(p.total ?? 0)), 0) || 0;
      const totalPedidos = pedidos?.length || 0;

      const { data, error: insErr } = await insforgeDb()
        .from('cortes')
        .insert([
          {
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            total_ventas: totalVentas,
            total_pedidos: totalPedidos,
            sucursal_id: sid,
            activo: true,
          },
        ])
        .select()
        .single();

      if (insErr) throw insErr;

      if (pedidos && pedidos.length > 0) {
        const detalles = pedidos.map((pedido) => ({
          corte_id: data.id,
          pedido_id: pedido.id,
        }));

        const { error: detallesError } = await insforgeDb()
          .from('detalle_cortes')
          .insert(detalles);

        if (detallesError) {
          console.error('Error creating detalle_cortes:', detallesError);
        }
      }

      await fetchCortes();
      return { data, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: msg };
    }
  };

  const getDetalleCorte = async (corteId: string) => {
    if (!sucursal_id?.trim()) {
      return { data: null, error: 'No hay sucursal activa en la sesión.' };
    }

    try {
      const { data: corteRow, error: corteErr } = await insforgeDb()
        .from('cortes')
        .select('id, sucursal_id')
        .eq('id', corteId)
        .maybeSingle();

      if (corteErr) throw corteErr;
      if (!corteRow?.id) return { data: null, error: 'Corte no encontrado.' };
      if (readSucursalId(corteRow as Record<string, unknown>) !== sucursal_id.trim()) {
        return { data: null, error: 'Este corte pertenece a otra tienda.' };
      }

      const { data: detalles, error } = await insforgeDb()
        .from('detalle_cortes')
        .select('*')
        .eq('corte_id', corteId);

      if (error) throw error;

      const pedidoIds = [...new Set((detalles || []).map((d) => String(d.pedido_id)).filter(Boolean))];
      let pedidoPorId = new Map<string, Record<string, unknown>>();

      if (pedidoIds.length > 0) {
        const pr = await insforgeDb()
          .from('pedidos')
          .select('*')
          .in('id', pedidoIds)
          .eq('sucursal_id', sucursal_id.trim());
        if (!pr.error && pr.data) {
          pedidoPorId = new Map(pr.data.map((p) => [String((p as Record<string, unknown>).id), p as Record<string, unknown>]));
        }
      }

      const alumnoIds = [...new Set(
        [...pedidoPorId.values()]
          .map((p) => p.alumno_id ?? p.alumnoId)
          .filter(Boolean)
          .map(String)
      )];
      const externoIds = [...new Set(
        [...pedidoPorId.values()]
          .map((p) => p.externo_id ?? p.externoId)
          .filter(Boolean)
          .map(String)
      )];

      const alumnoPorId = new Map<string, Record<string, unknown>>();
      if (alumnoIds.length > 0) {
        const ar = await insforgeDb()
          .from('alumno')
          .select('alumno_ref, alumno_nombre_completo, id')
          .in('id', alumnoIds);
        if (!ar.error && ar.data) {
          for (const a of ar.data) {
            const row = a as Record<string, unknown>;
            alumnoPorId.set(String(row.id), row);
          }
        }
      }

      const externoPorId = new Map<string, Record<string, unknown>>();
      if (externoIds.length > 0) {
        const er = await insforgeDb().from('externos').select('id, nombre').in('id', externoIds);
        if (!er.error && er.data) {
          for (const e of er.data) {
            const row = e as Record<string, unknown>;
            externoPorId.set(String(row.id), row);
          }
        }
      }

      const enriched = (detalles || []).map((det) => {
        const pedido = pedidoPorId.get(String(det.pedido_id));
        if (!pedido) return { ...det, pedido: null };
        const alumnoId = pedido.alumno_id ?? pedido.alumnoId;
        const externoId = pedido.externo_id ?? pedido.externoId;
        return {
          ...det,
          pedido: {
            ...pedido,
            alumno: alumnoId ? alumnoPorId.get(String(alumnoId)) : undefined,
            externo: externoId ? externoPorId.get(String(externoId)) : undefined,
          },
        };
      });

      return { data: enriched, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: msg };
    }
  };

  const cerrarCorte = async (id: string) => {
    if (!sucursal_id?.trim()) {
      return { data: null, error: 'No hay sucursal activa en la sesión.' };
    }

    try {
      const { data: corteRow, error: corteErr } = await insforgeDb()
        .from('cortes')
        .select('id, sucursal_id')
        .eq('id', id)
        .maybeSingle();

      if (corteErr) throw corteErr;
      if (!corteRow?.id) return { data: null, error: 'Corte no encontrado.' };
      if (readSucursalId(corteRow as Record<string, unknown>) !== sucursal_id.trim()) {
        return { data: null, error: 'Este corte pertenece a otra tienda.' };
      }

      const { data, error } = await insforgeDb()
        .from('cortes')
        .update({ activo: false })
        .eq('id', id)
        .eq('sucursal_id', sucursal_id.trim())
        .select()
        .single();

      if (error) throw error;
      await fetchCortes();
      return { data, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: msg };
    }
  };

  return {
    cortes,
    loading,
    error,
    crearCorte,
    getDetalleCorte,
    cerrarCorte,
    refetch: fetchCortes,
  };
}

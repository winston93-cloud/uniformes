'use client';

import { useState, useEffect } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Corte } from '../types';

export function useCortes() {
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCortes = async () => {
    try {
      setLoading(true);
      const { data, error } = await insforgeDb()
        .from('cortes')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;
      setCortes(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('Error fetching cortes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCortes();
  }, []);

  const crearCorte = async (fechaInicio: string, fechaFin: string) => {
    try {
      const fechaInicioObj = new Date(fechaInicio + 'T00:00:00');
      const fechaFinObj = new Date(fechaFin + 'T23:59:59');

      const { data: pedidos, error: pedidosError } = await insforgeDb()
        .from('pedidos')
        .select('id, total, estado')
        .eq('estado', 'COMPLETADO')
        .gte('created_at', fechaInicioObj.toISOString())
        .lte('created_at', fechaFinObj.toISOString());

      if (pedidosError) throw pedidosError;

      const totalVentas = pedidos?.reduce((sum, p) => sum + parseFloat(p.total.toString()), 0) || 0;
      const totalPedidos = pedidos?.length || 0;

      const { data, error } = await insforgeDb()
        .from('cortes')
        .insert([
          {
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            total_ventas: totalVentas,
            total_pedidos: totalPedidos,
            activo: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

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
    try {
      const { data: detalles, error } = await insforgeDb()
        .from('detalle_cortes')
        .select('*')
        .eq('corte_id', corteId);

      if (error) throw error;

      const pedidoIds = [...new Set((detalles || []).map((d) => String(d.pedido_id)).filter(Boolean))];
      let pedidoPorId = new Map<string, Record<string, unknown>>();

      if (pedidoIds.length > 0) {
        const pr = await insforgeDb().from('pedidos').select('*').in('id', pedidoIds);
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
    try {
      const { data, error } = await insforgeDb()
        .from('cortes')
        .update({ activo: false })
        .eq('id', id)
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

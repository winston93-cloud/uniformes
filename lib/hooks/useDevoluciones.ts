'use client';

import { useState, useEffect, useCallback } from 'react';
import { filtrarFilasPorSucursalSiHayColumna } from '@/lib/sucursalCliente';
import { getSupabaseErrorMessage } from '@/lib/supabase';
import { insforgeDb } from '@/lib/insforgeBrowser';

function readFk(row: Record<string, unknown>, snake: string, camel: string): string | null {
  const v = row[snake] ?? row[camel];
  if (v == null || v === '') return null;
  return String(v);
}

export interface Devolucion {
  id: string;
  folio: number;
  pedido_id: string;
  sucursal_id: string;
  usuario_id: number;
  tipo_devolucion: 'COMPLETA' | 'PARCIAL' | 'CAMBIO_TALLA' | 'CAMBIO_PRENDA';
  motivo: string;
  observaciones?: string;
  total_devolucion: number;
  reembolso_aplicado: boolean;
  monto_reembolsado: number;
  estado: 'PENDIENTE' | 'PROCESADA' | 'CANCELADA';
  created_at: string;
  updated_at: string;
}

export interface DetalleDevolucion {
  id?: string;
  devolucion_id: string;
  detalle_pedido_id: string;
  prenda_id: string;
  talla_id: string;
  cantidad_devuelta: number;
  precio_unitario: number;
  subtotal: number;
  es_cambio: boolean;
  prenda_cambio_id?: string;
  talla_cambio_id?: string;
  cantidad_cambio?: number;
  precio_cambio?: number;
  observaciones_detalle?: string;
}

export interface DevolucionConDetalles extends Devolucion {
  detalles: DetalleDevolucion[];
  pedido?: {
    cliente_nombre: string;
    total: number;
  };
  usuario?: {
    usuario_nombre: string;
    usuario_username: string;
  };
}

export interface CrearDevolucionData {
  pedido_id: string;
  sucursal_id: string;
  usuario_id: number;
  tipo_devolucion: Devolucion['tipo_devolucion'];
  motivo: string;
  observaciones?: string;
  reembolso_aplicado?: boolean;
  monto_reembolsado?: number;
  detalles: Omit<DetalleDevolucion, 'id' | 'devolucion_id'>[];
}

export function useDevoluciones(sucursal_id?: string) {
  const [devoluciones, setDevoluciones] = useState<DevolucionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevoluciones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let { data, error: fetchError } = await insforgeDb()
        .from('devoluciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        const fb = await insforgeDb().from('devoluciones').select('*');
        if (!fb.error && fb.data) {
          data = fb.data;
          fetchError = null;
          const ts = (r: Record<string, unknown>) => {
            const raw = r.created_at ?? r.createdAt;
            return raw ? Date.parse(String(raw)) : 0;
          };
          data.sort((a, b) => ts(b as Record<string, unknown>) - ts(a as Record<string, unknown>));
        }
      }

      if (fetchError) throw fetchError;

      const devs = filtrarFilasPorSucursalSiHayColumna(
        (data || []) as Record<string, unknown>[],
        sucursal_id
      );
      const pedidoIds = [
        ...new Set(devs.map((d) => readFk(d as Record<string, unknown>, 'pedido_id', 'pedidoId')).filter(Boolean)),
      ] as string[];

      let pedidoPorId = new Map<string, { cliente_nombre: string; total: number }>();
      if (pedidoIds.length > 0) {
        const pr = await insforgeDb().from('pedidos').select('id, cliente_nombre, total').in('id', pedidoIds);
        if (!pr.error && pr.data) {
          pedidoPorId = new Map(
            pr.data.map((p) => {
              const row = p as Record<string, unknown>;
              return [
                String(row.id),
                {
                  cliente_nombre: String(row.cliente_nombre ?? row.clienteNombre ?? ''),
                  total: Number(row.total ?? 0),
                },
              ];
            })
          );
        }
      }

      let usuarioPorId = new Map<
        string,
        { usuario_nombre: string; usuario_username: string }
      >();
      const usuarioIds = [
        ...new Set(
          devs.map((d) => {
            const id = (d as Record<string, unknown>).usuario_id ?? (d as Record<string, unknown>).usuarioId;
            return id != null ? String(id) : '';
          }).filter(Boolean)
        ),
      ];
      const usuarioNumericIds = usuarioIds
        .map((id) => parseInt(id, 10))
        .filter((n) => !Number.isNaN(n));
      if (usuarioNumericIds.length > 0) {
        const ur = await insforgeDb().from('usuario').select('*').in('usuario_id', usuarioNumericIds);
        if (!ur.error && ur.data) {
          usuarioPorId = new Map(
            ur.data.map((u) => {
              const row = u as Record<string, unknown>;
              const uid = String(row.usuario_id ?? row.usuarioId ?? '');
              return [
                uid,
                {
                  usuario_nombre: String(row.usuario_nombre ?? row.usuarioNombre ?? ''),
                  usuario_username: String(row.usuario_username ?? row.usuarioUsername ?? ''),
                },
              ];
            })
          );
        }
      }

      const devolucionesConDetalles: DevolucionConDetalles[] = [];

      for (const dev of devs) {
        const dr = dev as Record<string, unknown>;
        const { data: detalles, error: detallesError } = await insforgeDb()
          .from('detalle_devoluciones')
          .select('*')
          .eq('devolucion_id', dr.id as string);

        if (detallesError) {
          console.error('Error al cargar detalles:', detallesError);
          continue;
        }

        const pid = readFk(dr, 'pedido_id', 'pedidoId');
        const uid = dr.usuario_id ?? dr.usuarioId;

        devolucionesConDetalles.push({
          ...(dev as unknown as Devolucion),
          detalles: detalles || [],
          pedido: pid ? pedidoPorId.get(pid) : undefined,
          usuario:
            uid != null
              ? usuarioPorId.get(String(uid))
              : undefined,
        });
      }

      setDevoluciones(devolucionesConDetalles);
    } catch (err: unknown) {
      console.error('Error al cargar devoluciones:', err);
      setError(getSupabaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [sucursal_id]);

  useEffect(() => {
    fetchDevoluciones();
  }, [fetchDevoluciones]);

  const crearDevolucion = async (data: CrearDevolucionData) => {
    try {
      const totalDevolucion = data.detalles.reduce(
        (sum, det) => sum + det.subtotal,
        0
      );

      const { data: devolucion, error: devError } = await insforgeDb()
        .from('devoluciones')
        .insert({
          pedido_id: data.pedido_id,
          sucursal_id: data.sucursal_id,
          usuario_id: data.usuario_id,
          tipo_devolucion: data.tipo_devolucion,
          motivo: data.motivo,
          observaciones: data.observaciones,
          total_devolucion: totalDevolucion,
          reembolso_aplicado: data.reembolso_aplicado || false,
          monto_reembolsado: data.monto_reembolsado || 0,
          estado: 'PENDIENTE',
        })
        .select()
        .single();

      if (devError) throw devError;

      const detallesConId = data.detalles.map((det) => ({
        ...det,
        devolucion_id: devolucion.id,
      }));

      const { error: detallesError } = await insforgeDb()
        .from('detalle_devoluciones')
        .insert(detallesConId);

      if (detallesError) throw detallesError;

      const { data: proc, error: procErr } = await insforgeDb().rpc('procesar_devolucion_atomica', {
        p_devolucion_id: devolucion.id,
      });
      if (procErr) throw procErr;
      if (proc && proc.success === false) {
        throw new Error(proc.error || 'Error al procesar devolución');
      }

      const { data: ajuste, error: ajusteErr } = await insforgeDb().rpc(
        'ajustar_precio_pedido_tras_devolucion',
        { p_devolucion_id: devolucion.id }
      );
      if (ajusteErr) throw ajusteErr;
      if (ajuste && ajuste.success === false) {
        throw new Error(ajuste.error || 'Error al ajustar precio del pedido tras devolución');
      }

      await fetchDevoluciones();

      return { success: true, data: devolucion };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error en crearDevolucion:', err);
      return { success: false, error: msg };
    }
  };

  const procesarDevolucion = async (id: string) => {
    try {
      const { data, error } = await insforgeDb().rpc('procesar_devolucion_atomica', {
        p_devolucion_id: id,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Error al procesar devolución');
      }

      const { data: ajuste, error: ajusteErr } = await insforgeDb().rpc(
        'ajustar_precio_pedido_tras_devolucion',
        { p_devolucion_id: id }
      );
      if (ajusteErr) throw ajusteErr;
      if (ajuste && ajuste.success === false) {
        throw new Error(ajuste.error || 'Error al ajustar precio del pedido tras devolución');
      }

      await fetchDevoluciones();
      return { success: true, message: data.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error al procesar devolución:', err);
      return { success: false, error: msg };
    }
  };

  const cancelarDevolucion = async (id: string) => {
    try {
      const { error } = await insforgeDb()
        .from('devoluciones')
        .update({ estado: 'CANCELADA' })
        .eq('id', id);

      if (error) throw error;

      await fetchDevoluciones();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error al cancelar devolución:', err);
      return { success: false, error: msg };
    }
  };

  return {
    devoluciones,
    loading,
    error,
    fetchDevoluciones,
    crearDevolucion,
    procesarDevolucion,
    cancelarDevolucion,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseErrorMessage, usuarioIdParaRpc } from '@/lib/supabase';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { REFETCH_PEDIDOS_EVENT } from '@/lib/refetchPedidosEvent';
import {
  dividirDetallesPorLinea,
  esCuentaWinston,
  type LineaVentaWinston,
  type SesionLineaVenta,
} from '@/lib/winstonLineaVenta';

interface Pedido {
  id: string;
  /** Folio de venta (ej. PED-YYYYMM-0001, wu0001, wt0001) */
  folio?: string | null;
  linea_venta?: LineaVentaWinston | null;
  cotizacion_id?: string | null;
  fecha: string;
  cliente_id: string;
  cliente_tipo: 'alumno' | 'externo';
  cliente_nombre: string;
  total: number;
  estado: 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO' | 'CANCELADO_PARCIAL';
  observaciones?: string;
  modalidad_pago: 'TOTAL' | 'ANTICIPO';
  efectivo_recibido: number | string;
  created_at?: string;
  updated_at?: string;
}

interface DetallePedido {
  id?: string;
  pedido_id: string;
  prenda_id: string;
  prenda_nombre?: string;
  talla_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  pendiente: number;
  especificaciones?: string;
}

export type PedidoCreadoResumen = {
  id: string;
  folio?: string | null;
  linea_venta?: LineaVentaWinston | null;
};

/** InsForge/SDK a veces devuelve camelCase; sucursal en datos viejos puede ser null y .eq excluye todo. */
function normalizarFilaPedidoApi(p: Record<string, unknown>) {
  const created_at =
    (p.created_at ?? p.createdAt ?? p.updated_at ?? p.updatedAt) as string | undefined;
  const tipo_cliente = (p.tipo_cliente ?? p.tipoCliente) as string | undefined;
  const sucursal_id = (p.sucursal_id ?? p.sucursalId) as string | null | undefined;
  const cliente_nombre = (p.cliente_nombre ?? p.clienteNombre) as string | undefined;
  const linea_venta = (p.linea_venta ?? p.lineaVenta) as LineaVentaWinston | null | undefined;
  return {
    ...p,
    created_at,
    tipo_cliente,
    sucursal_id,
    cliente_nombre: cliente_nombre ?? p.cliente_nombre,
    linea_venta,
  };
}

function totalDetalles(detalles: Array<{ subtotal?: number; total?: number; precio_unitario?: number; cantidad?: number }>) {
  return detalles.reduce((sum, d) => {
    if (d.subtotal != null) return sum + Number(d.subtotal);
    if (d.total != null) return sum + Number(d.total);
    return sum + Number(d.precio_unitario ?? 0) * Number(d.cantidad ?? 0);
  }, 0);
}

export function usePedidos(sucursal_id?: string) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPedidos = useCallback(async () => {
    try {
      setLoading(true);

      if (!sucursal_id?.trim()) {
        setPedidos([]);
        return;
      }

      const sid = sucursal_id.trim();
      let data: unknown[] | null = null;
      let error: { message: string } | null = null;

      const r = await insforgeDb()
        .from('pedidos')
        .select('*')
        .eq('sucursal_id', sid);

      data = r.data ?? null;
      error = r.error;

      if (error) {
        const plain = await insforgeDb().from('pedidos').select('*').eq('sucursal_id', sid);
        if (!plain.error) {
          data = plain.data ?? null;
          error = null;
        }
      }

      if (error) throw error;

      const ts = (row: unknown) => {
        const p = row as Record<string, unknown>;
        const raw = p.created_at ?? p.createdAt;
        return raw ? Date.parse(String(raw)) : 0;
      };
      const sorted = [...(data || [])].sort((a, b) => ts(b) - ts(a));

      const pedidosMapeados = sorted.map((raw) => {
        const p = normalizarFilaPedidoApi(raw as Record<string, unknown>);
        const fechaStr =
          p.created_at && !Number.isNaN(Date.parse(String(p.created_at)))
            ? new Date(String(p.created_at)).toLocaleDateString('es-MX')
            : '';
        return {
          ...p,
          cliente_tipo: p.tipo_cliente,
          fecha: fechaStr,
        } as unknown as Pedido;
      });

      setPedidos(pedidosMapeados);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [sucursal_id]);

  const reconciliarUbicacionesVenta = async (
    detallesJsonb: Array<Record<string, unknown>>,
    sucId?: string
  ) => {
    try {
      const vendidos = detallesJsonb.filter((d) => Number(d?.cantidad_con_stock ?? 0) > 0);
      for (const d of vendidos) {
        if (!sucId) continue;
        const { data: costoRow, error: costoErr } = await insforgeDb()
          .from('costos')
          .select('id')
          .eq('prenda_id', String(d.prenda_id))
          .eq('talla_id', String(d.talla_id))
          .eq('sucursal_id', String(sucId))
          .maybeSingle();
        if (costoErr || !costoRow?.id) continue;
        await fetch('/api/costos/reconciliar-ubicaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ costo_id: String(costoRow.id) }),
        }).catch(() => null);
      }
    } catch {
      // No bloquear la venta por esto.
    }
  };

  const crearPedidoAtomico = async (
    pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>,
    detalles: Omit<DetallePedido, 'id' | 'pedido_id'>[],
    pedido_sucursal_id?: string,
    linea_venta?: LineaVentaWinston | null
  ) => {
    const detallesJsonb = detalles.map((det) => ({
      prenda_id: det.prenda_id,
      talla_id: det.talla_id,
      cantidad: det.cantidad,
      cantidad_con_stock:
        (det as { cantidad_con_stock?: number }).cantidad_con_stock !== undefined
          ? (det as { cantidad_con_stock?: number }).cantidad_con_stock
          : det.cantidad,
      cantidad_pendiente:
        (det as { cantidad_pendiente?: number }).cantidad_pendiente !== undefined
          ? (det as { cantidad_pendiente?: number }).cantidad_pendiente
          : 0,
      tiene_stock: (det as { tiene_stock?: boolean }).tiene_stock !== false,
      especificaciones: det.especificaciones || '',
    }));

    const { data, error } = await insforgeDb().rpc('crear_pedido_atomico', {
      p_tipo_cliente: pedido.cliente_tipo,
      p_cliente_nombre: pedido.cliente_nombre,
      p_sucursal_id: pedido_sucursal_id || sucursal_id,
      p_usuario_id: null,
      p_alumno_id: null,
      p_externo_id: null,
      p_estado: pedido.estado,
      p_notas: pedido.observaciones || null,
      p_detalles: detallesJsonb,
      p_linea_venta: linea_venta ?? null,
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data.error || data.message || 'Error desconocido');
    }

    await reconciliarUbicacionesVenta(detallesJsonb, pedido_sucursal_id || sucursal_id);

    return {
      id: data.pedido_id as string,
      folio: data.folio as string | undefined,
      linea_venta: (data.linea_venta as LineaVentaWinston | null) ?? linea_venta ?? null,
      message: data.message as string | undefined,
    };
  };

  const crearPedido = async (
    pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>,
    detalles: Omit<DetallePedido, 'id' | 'pedido_id'>[],
    pedido_sucursal_id?: string,
    _usuario_id?: number | string,
    linea_venta?: LineaVentaWinston | null
  ) => {
    try {
      const creado = await crearPedidoAtomico(pedido, detalles, pedido_sucursal_id, linea_venta);
      await fetchPedidos();
      return {
        success: true,
        data: { id: creado.id, folio: creado.folio },
        message: creado.message,
      };
    } catch (error: unknown) {
      const msg = getSupabaseErrorMessage(error);
      console.error('❌ Error al crear pedido:', error);
      return { success: false, error: msg };
    }
  };

  /** Winston: divide carrito mixto (prendas → tenis → remate tenis). */
  const crearPedidosDesdeCarrito = async (
    pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>,
    detalles: Omit<DetallePedido, 'id' | 'pedido_id'>[],
    pedido_sucursal_id?: string,
    sesion?: SesionLineaVenta | null
  ): Promise<{ success: boolean; pedidos: PedidoCreadoResumen[]; error?: string; message?: string }> => {
    const sid = pedido_sucursal_id || sucursal_id;
    const esWinston = esCuentaWinston(sesion);

    if (!esWinston) {
      const r = await crearPedido(pedido, detalles, sid);
      if (!r.success) {
        return { success: false, pedidos: [], error: String(r.error ?? 'Error al crear pedido') };
      }
      return {
        success: true,
        pedidos: [{ id: r.data!.id, folio: r.data!.folio, linea_venta: null }],
        message: r.message,
      };
    }

    const { prendas, tenis, remate_tenis } = dividirDetallesPorLinea(detalles);
    const creados: PedidoCreadoResumen[] = [];

    try {
      if (prendas.length > 0) {
        const totalPrendas = totalDetalles(prendas);
        const creado = await crearPedidoAtomico(
          { ...pedido, total: totalPrendas },
          prendas,
          sid,
          'prendas'
        );
        creados.push(creado);
      }

      if (tenis.length > 0) {
        const totalTenis = totalDetalles(tenis);
        const creado = await crearPedidoAtomico(
          { ...pedido, total: totalTenis },
          tenis,
          sid,
          'tenis'
        );
        creados.push(creado);
      }

      if (remate_tenis.length > 0) {
        const totalRemate = totalDetalles(remate_tenis);
        const creado = await crearPedidoAtomico(
          { ...pedido, total: totalRemate },
          remate_tenis,
          sid,
          'remate_tenis'
        );
        creados.push(creado);
      }

      if (creados.length === 0) {
        return { success: false, pedidos: [], error: 'No hay partidas válidas en el carrito.' };
      }

      await fetchPedidos();

      const folios = creados.map((p) => p.folio).filter(Boolean).join(' y ');
      return {
        success: true,
        pedidos: creados,
        message:
          creados.length > 1
            ? `Se generaron ${creados.length} recibos: ${folios}`
            : `Pedido ${folios} creado correctamente`,
      };
    } catch (error: unknown) {
      const msg = getSupabaseErrorMessage(error);
      return {
        success: false,
        pedidos: creados,
        error: msg,
      };
    }
  };

  const actualizarEstadoPedido = async (
    id: string,
    nuevoEstado: Pedido['estado'],
    usuario_id?: string | null
  ) => {
    try {
      if (nuevoEstado === 'COMPLETADO') {
        const { data, error } = await insforgeDb().rpc('completar_pedido_atomico', {
          p_pedido_id: id,
          p_usuario_id: usuarioIdParaRpc(usuario_id),
        });
        if (error) throw error;
        if (data && data.success === false) {
          throw new Error(data.error || 'Error al completar pedido');
        }
        const warnings = Array.isArray(data?.warnings)
          ? (data.warnings as string[]).filter(Boolean)
          : [];
        if (warnings.length > 0) {
          await fetchPedidos();
          return { success: true, warnings };
        }
      } else {
        const { error } = await insforgeDb()
          .from('pedidos')
          .update({ estado: nuevoEstado })
          .eq('id', id);

        if (error) throw error;
      }

      await fetchPedidos();
      return { success: true };
    } catch (error) {
      const msg = getSupabaseErrorMessage(error);
      console.error('Error al actualizar estado:', msg, error);
      return { success: false, error: msg };
    }
  };

  const eliminarPedidoDefinitivo = async (pedidoId: string, motivo?: string) => {
    try {
      const { data, error } = await insforgeDb().rpc('cancelar_pedido_atomico', {
        p_pedido_id: pedidoId,
        p_usuario_id: null,
        p_items: null,
        p_motivo: motivo || 'ELIMINACION DEFINITIVA',
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Error al cancelar pedido antes de eliminar');
      }

      const { error: delErr } = await insforgeDb().from('pedidos').delete().eq('id', pedidoId);
      if (delErr) throw delErr;

      await fetchPedidos();
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error al eliminar pedido definitivamente:', error);
      return { success: false, error: msg };
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    const onRefetch = () => {
      void fetchPedidos();
    };
    window.addEventListener(REFETCH_PEDIDOS_EVENT, onRefetch);
    return () => window.removeEventListener(REFETCH_PEDIDOS_EVENT, onRefetch);
  }, [fetchPedidos]);

  return {
    pedidos,
    loading,
    fetchPedidos,
    crearPedido,
    crearPedidosDesdeCarrito,
    actualizarEstadoPedido,
    eliminarPedidoDefinitivo,
  };
}

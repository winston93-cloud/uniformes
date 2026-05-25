'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseErrorMessage, supabase } from '@/lib/supabase';
import { REFETCH_PEDIDOS_EVENT } from '@/lib/refetchPedidosEvent';

interface Pedido {
  id: string;
  /** Folio de venta (ej. PED-YYYYMM-0001), p. ej. generado al cerrar cotización terminada */
  folio?: string | null;
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
  talla_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  pendiente: number;
  especificaciones?: string;
}

/** InsForge/SDK a veces devuelve camelCase; sucursal en datos viejos puede ser null y .eq excluye todo. */
function normalizarFilaPedidoApi(p: Record<string, unknown>) {
  const created_at =
    (p.created_at ?? p.createdAt ?? p.updated_at ?? p.updatedAt) as string | undefined;
  const tipo_cliente = (p.tipo_cliente ?? p.tipoCliente) as string | undefined;
  const sucursal_id = (p.sucursal_id ?? p.sucursalId) as string | null | undefined;
  const cliente_nombre = (p.cliente_nombre ?? p.clienteNombre) as string | undefined;
  return {
    ...p,
    created_at,
    tipo_cliente,
    sucursal_id,
    cliente_nombre: cliente_nombre ?? p.cliente_nombre,
  };
}

export function usePedidos(sucursal_id?: string) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPedidos = useCallback(async () => {
    try {
      setLoading(true);
      // InsForge a veces devuelve 400 con or(sucursal_id...); unimos dos consultas
      let data: unknown[] | null = null;
      let error: { message: string } | null = null;

      if (sucursal_id) {
        const [q1, q2] = await Promise.all([
          supabase.from('pedidos').select('*').eq('sucursal_id', sucursal_id),
          supabase.from('pedidos').select('*').is('sucursal_id', null),
        ]);
        if (q1.error && q2.error) {
          error = q1.error;
        } else {
          const m = new Map<string, unknown>();
          for (const row of [...(q1.data || []), ...(q2.data || [])]) {
            const id = (row as { id: string }).id;
            if (id) m.set(String(id), row);
          }
          data = [...m.values()];
          const ts = (r: unknown) => {
            const p = r as Record<string, unknown>;
            const raw = p.created_at ?? p.createdAt;
            return raw ? Date.parse(String(raw)) : 0;
          };
          data.sort((a, b) => ts(b) - ts(a));
        }
      } else {
        const r = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
        data = r.data ?? null;
        error = r.error;
        if (error) {
          const plain = await supabase.from('pedidos').select('*');
          if (!plain.error && plain.data) {
            data = plain.data;
            error = null;
            const ts = (row: unknown) => {
              const p = row as Record<string, unknown>;
              const raw = p.created_at ?? p.createdAt;
              return raw ? Date.parse(String(raw)) : 0;
            };
            data.sort((a, b) => ts(b) - ts(a));
          }
        }
      }

      if (error) throw error;

      // Sesión (env) puede apuntar a otro UUID que los pedidos migrados en InsForge
      if (sucursal_id && (!data || data.length === 0)) {
        const fb = await supabase.from('pedidos').select('*');
        if (!fb.error && fb.data && fb.data.length > 0) {
          console.warn(
            '[pedidos] Sin resultados para la sucursal de la sesión; mostrando todos los pedidos. Revisa NEXT_PUBLIC_DEFAULT_SUCURSAL_ID vs pedidos.sucursal_id en InsForge.'
          );
          data = fb.data;
        }
      }

      const pedidosMapeados = (data || []).map((raw) => {
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

  const crearPedido = async (pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>, detalles: Omit<DetallePedido, 'id' | 'pedido_id'>[], pedido_sucursal_id?: string, usuario_id?: number | string) => {
    try {
      console.log('📦 Creando pedido con función atómica...', pedido);
      
      // Preparar detalles en formato JSONB para la función
      // CRÍTICO: Incluir cantidad_con_stock y cantidad_pendiente para división automática
      const detallesJsonb = detalles.map(det => ({
        prenda_id: det.prenda_id,
        talla_id: det.talla_id,
        cantidad: det.cantidad,
        // IMPORTANTE: Usar !== undefined en vez de || porque 0 es un valor válido
        cantidad_con_stock: (det as any).cantidad_con_stock !== undefined ? (det as any).cantidad_con_stock : det.cantidad,
        cantidad_pendiente: (det as any).cantidad_pendiente !== undefined ? (det as any).cantidad_pendiente : 0,
        tiene_stock: (det as any).tiene_stock !== false,
        especificaciones: det.especificaciones || ''
      }));

      // HOTFIX: en algunas BD legacy, pedidos.usuario_id sigue siendo SMALLINT.
      // Si mandamos UUID revienta con: "column 'usuario_id' is of type smallint but expression is of type uuid".
      // En esos entornos mandamos NULL para no bloquear creación de pedidos.
      const usuario_uuid = null;

      // LLAMAR A LA FUNCIÓN ATÓMICA que hace TODO en una transacción
      const { data, error } = await supabase.rpc('crear_pedido_atomico', {
        p_tipo_cliente: pedido.cliente_tipo,
        p_cliente_nombre: pedido.cliente_nombre,
        p_sucursal_id: pedido_sucursal_id || sucursal_id,
        p_usuario_id: usuario_uuid,
        p_alumno_id: null,
        p_externo_id: null,
        p_estado: pedido.estado,
        p_notas: pedido.observaciones || null,
        p_detalles: detallesJsonb
      });

      if (error) {
        console.error('❌ Error en función atómica:', error);
        throw error;
      }

      console.log('✅ Respuesta función atómica:', data);

      // Verificar respuesta
      if (!data.success) {
        throw new Error(data.error || data.message || 'Error desconocido');
      }

      // Post-fix: en Supabase prod puede existir una versión vieja de crear_pedido_atomico
      // que descuenta costos.stock pero no costo_ubicaciones. Para garantizar consistencia,
      // reconciliamos ubicaciones vs stock por cada costo vendido (cantidad_con_stock > 0).
      try {
        const sucId = pedido_sucursal_id || sucursal_id;
        const vendidos = detallesJsonb.filter((d: any) => Number(d?.cantidad_con_stock ?? 0) > 0);
        for (const d of vendidos) {
          if (!sucId) continue;
          // eslint-disable-next-line no-await-in-loop
          const { data: costoRow, error: costoErr } = await supabase
            .from('costos')
            .select('id')
            .eq('prenda_id', String(d.prenda_id))
            .eq('talla_id', String(d.talla_id))
            .eq('sucursal_id', String(sucId))
            .maybeSingle();
          if (costoErr || !costoRow?.id) continue;
          // eslint-disable-next-line no-await-in-loop
          await fetch('/api/costos/reconciliar-ubicaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ costo_id: String(costoRow.id) }),
          }).catch(() => null);
        }
      } catch {
        // No bloquear la venta por esto: es corrección de consistencia.
      }

      await fetchPedidos();
      return { 
        success: true, 
        data: { id: data.pedido_id },
        message: data.message 
      };
    } catch (error: any) {
      console.error('❌ Error al crear pedido:', error);
      return { 
        success: false, 
        error: error.message || error 
      };
    }
  };

  const actualizarEstadoPedido = async (
    id: string,
    nuevoEstado: Pedido['estado'],
    usuario_id?: string | null
  ) => {
    try {
      // COMPLETADO: debe descontar pendientes en BD de forma atómica
      if (nuevoEstado === 'COMPLETADO') {
        const { data, error } = await supabase.rpc('completar_pedido_atomico', {
          p_pedido_id: id,
          p_usuario_id: usuario_id ?? null,
        });
        if (error) throw error;
        if (data && data.success === false) {
          throw new Error(data.error || 'Error al completar pedido');
        }
      } else {
        const { error } = await supabase
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
      // 1) Cancelar todo (reponer stock de entregado y borrar detalle_pedidos) de forma atómica.
      const { data, error } = await supabase.rpc('cancelar_pedido_atomico', {
        p_pedido_id: pedidoId,
        p_usuario_id: null,
        p_items: null,
        p_motivo: motivo || 'ELIMINACION DEFINITIVA',
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Error al cancelar pedido antes de eliminar');
      }

      // 2) Borrar el pedido (definitivo). Si quedara algún detalle, FK debe cascade.
      const { error: delErr } = await supabase.from('pedidos').delete().eq('id', pedidoId);
      if (delErr) throw delErr;

      await fetchPedidos();
      return { success: true };
    } catch (error: any) {
      console.error('Error al eliminar pedido definitivamente:', error);
      return { success: false, error: error.message || error };
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
    actualizarEstadoPedido,
    eliminarPedidoDefinitivo,
  };
}


'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseErrorMessage } from '@/lib/supabase';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Alumno, Cotizacion, DetalleCotizacion, Externo } from '@/lib/types';
import { compareCotizacionesPorFechaCotizacionDesc } from '@/lib/cotizacionesSort';
import { calcularMontosImpuestosCotizacion } from '@/lib/cotizacionesImpuestos';
import { transicionEstadoCotizacionValida, ESTADO_COTIZACION_BORRADOR } from '@/lib/cotizacionesEstados';
import { isUuid, resolverAlumnoUuidParaCotizacion } from '@/lib/resolverAlumnoCotizacion';
import { fetchAlumnosByIds } from '@/lib/alumnoClientApi';
import { REFETCH_PEDIDOS_EVENT } from '@/lib/refetchPedidosEvent';

export interface PartidaCotizacion {
  prenda_nombre: string;
  talla: string;
  color: string;
  especificaciones: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  orden: number;
  tipo_precio_usado: 'mayoreo' | 'menudeo';
  prenda_id?: string | null;
  costo_id?: string | null;
  es_manual: boolean;
  /** Clave estable para listas en UI; no se persiste en BD. */
  ui_key?: string;
}

/** Evita embed PostgREST `alumno(*)`: alumnos viven en Winston Servicios. */
async function relacionarClienteParaCotizaciones(
  cotRows: Record<string, unknown>[]
): Promise<Cotizacion[]> {
  const alumnoIds = [
    ...new Set(cotRows.map((r) => r.alumno_id).filter((x) => x != null && x !== '')),
  ].map(String);
  const externoIds = [
    ...new Set(cotRows.map((r) => r.externo_id).filter((x) => x != null && x !== '')),
  ].map(String);

  const alumnoPorId = await fetchAlumnosByIds(alumnoIds);

  const externoPorId = new Map<string, Externo>();
  if (externoIds.length > 0) {
    const ex = await insforgeDb().from('externos').select('*').in('id', externoIds);
    if (!ex.error && ex.data) {
      for (const row of ex.data) {
        externoPorId.set(String((row as Externo).id), row as Externo);
      }
    }
  }

  return cotRows.map((raw) => {
    const c = raw as unknown as Cotizacion;
    const aid = c.alumno_id != null ? String(c.alumno_id) : '';
    const eid = c.externo_id != null ? String(c.externo_id) : '';
    return {
      ...c,
      alumno: aid ? alumnoPorId.get(aid) : undefined,
      externo: eid ? externoPorId.get(eid) : undefined,
    };
  });
}

export interface NuevaCotizacion {
  alumno_id?: string;
  /** Referencia del alumno; sirve para resolver UUID en la tabla `alumno`. */
  alumno_referencia?: string;
  alumno_nombre?: string;
  externo_id?: string;
  tipo_cliente: 'alumno' | 'externo';
  fecha_vigencia?: string;
  fecha_entrega?: string;
  observaciones?: string;
  condiciones_pago?: string;
  tiempo_entrega?: string;
  partidas: PartidaCotizacion[];
  incluir_iva?: boolean;
  incluir_isr?: boolean;
  metodo_pago_id?: string | null;
  forma_pago_id?: string | null;
  metodo_pago_pdf?: string | null;
  forma_pago_pdf?: string | null;
}

export function useCotizaciones(options?: { autoCargar?: boolean }) {
  const autoCargar = options?.autoCargar !== false;
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener todas las cotizaciones
  const obtenerCotizaciones = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      let q = await insforgeDb()
        .from('cotizaciones')
        .select('*')
        .order('fecha_cotizacion', { ascending: false });
      if (q.error) {
        q = await insforgeDb().from('cotizaciones').select('*').order('created_at', { ascending: false });
      }
      if (q.error) throw q.error;

      const list = await relacionarClienteParaCotizaciones((q.data || []) as Record<string, unknown>[]);
      setCotizaciones([...list].sort(compareCotizacionesPorFechaCotizacionDesc));
    } catch (err) {
      console.error('Error al obtener cotizaciones:', err);
      setError(getSupabaseErrorMessage(err));
    } finally {
      setCargando(false);
    }
  }, []);

  // Obtener una cotización con su detalle
  const obtenerCotizacion = useCallback(async (id: string) => {
    try {
      const { data: cotRaw, error: cotError } = await insforgeDb().from('cotizaciones').select('*').eq('id', id).single();

      if (cotError) throw cotError;

      const [cotizacionEnriquecida] = await relacionarClienteParaCotizaciones([
        (cotRaw || {}) as Record<string, unknown>,
      ]);
      const cotizacion = cotizacionEnriquecida;

      const { data: detalle, error: detError } = await insforgeDb()
        .from('detalle_cotizacion')
        .select('*')
        .eq('cotizacion_id', id)
        .order('orden', { ascending: true });

      if (detError) throw detError;

      return { cotizacion, detalle: detalle || [] };
    } catch (err) {
      console.error('Error al obtener cotización:', err);
      throw err;
    }
  }, []);

  // Generar folio automático
  const generarFolio = async (): Promise<string> => {
    try {
      const { data, error } = await insforgeDb().rpc('generar_folio_cotizacion');
      if (error) throw error;
      return data as string;
    } catch (err) {
      console.error('Error al generar folio:', err);
      throw err;
    }
  };

  type EstadoGuardadoCotizacion = typeof ESTADO_COTIZACION_BORRADOR | 'emitido';

  const resolverClienteIds = async (datos: NuevaCotizacion) => {
    let alumnoId: string | null = datos.alumno_id ?? null;
    if (datos.tipo_cliente === 'alumno' && alumnoId) {
      alumnoId = await resolverAlumnoUuidParaCotizacion(
        alumnoId,
        datos.alumno_referencia,
        datos.alumno_nombre || ''
      );
    }

    const externoId = datos.externo_id ?? null;
    if (datos.tipo_cliente === 'externo' && externoId && !isUuid(externoId)) {
      return {
        error: 'Cliente externo inválido. Vuelve a seleccionar el cliente.',
        alumnoId: null,
        externoId: null,
      };
    }

    return { error: null, alumnoId, externoId };
  };

  const calcularTotalesPartidas = (datos: NuevaCotizacion) => {
    const subtotalPartidas = datos.partidas.reduce((sum, p) => sum + p.subtotal, 0);
    const incluirIva = datos.incluir_iva === true;
    const incluirIsr = datos.incluir_isr === true;
    return {
      subtotalPartidas,
      incluirIva,
      incluirIsr,
      ...calcularMontosImpuestosCotizacion(subtotalPartidas, incluirIva, incluirIsr),
    };
  };

  /** Crea o actualiza cotización con estado en_proceso o emitido. */
  const guardarCotizacion = async (
    cotizacionId: string | null,
    datos: NuevaCotizacion,
    estadoDestino: EstadoGuardadoCotizacion
  ) => {
    try {
      const cliente = await resolverClienteIds(datos);
      if (cliente.error) {
        return { data: null, error: cliente.error, id: cotizacionId };
      }

      const { subtotal, total, incluirIva, incluirIsr } = calcularTotalesPartidas(datos);

      if (cotizacionId) {
        const { data: existente, error: fetchErr } = await insforgeDb()
          .from('cotizaciones')
          .select('estado')
          .eq('id', cotizacionId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!existente?.estado) {
          return { data: null, error: 'No se encontró la cotización.', id: cotizacionId };
        }

        if (
          estadoDestino === ESTADO_COTIZACION_BORRADOR &&
          existente.estado !== ESTADO_COTIZACION_BORRADOR
        ) {
          return {
            data: null,
            error: 'Solo se puede guardar borrador en cotizaciones en proceso.',
            id: cotizacionId,
          };
        }

        if (
          estadoDestino === 'emitido' &&
          existente.estado !== ESTADO_COTIZACION_BORRADOR &&
          existente.estado !== 'emitido'
        ) {
          return {
            data: null,
            error: 'Solo se puede editar cotizaciones en proceso o emitidas.',
            id: cotizacionId,
          };
        }

        const { data: cotizacion, error: cotError } = await insforgeDb()
          .from('cotizaciones')
          .update({
            alumno_id: datos.tipo_cliente === 'alumno' ? cliente.alumnoId : null,
            externo_id: datos.tipo_cliente === 'externo' ? cliente.externoId : null,
            tipo_cliente: datos.tipo_cliente,
            fecha_vigencia: datos.fecha_vigencia || null,
            fecha_entrega: datos.fecha_entrega || null,
            subtotal,
            total,
            observaciones: datos.observaciones || null,
            condiciones_pago: datos.condiciones_pago || '50% anticipo, 50% contra entrega',
            tiempo_entrega: datos.tiempo_entrega || '5-7 días hábiles',
            incluir_iva: incluirIva,
            incluir_isr: incluirIsr,
            metodo_pago_id: datos.metodo_pago_id || null,
            forma_pago_id: datos.forma_pago_id || null,
            metodo_pago_pdf: datos.metodo_pago_pdf?.trim() || null,
            forma_pago_pdf: datos.forma_pago_pdf?.trim() || null,
            estado: estadoDestino,
          })
          .eq('id', cotizacionId)
          .select()
          .single();

        if (cotError) throw cotError;

        const { error: delErr } = await insforgeDb()
          .from('detalle_cotizacion')
          .delete()
          .eq('cotizacion_id', cotizacionId);

        if (delErr) throw delErr;

        const partidas = datos.partidas.map((p, index) => {
          const { ui_key: _uiKey, ...resto } = p;
          return {
            cotizacion_id: cotizacionId,
            ...resto,
            orden: index + 1,
          };
        });

        const { error: insErr } = await insforgeDb().from('detalle_cotizacion').insert(partidas);
        if (insErr) throw insErr;

        await obtenerCotizaciones();
        return { data: cotizacion, error: null, id: cotizacionId };
      }

      const folio = await generarFolio();
      const { data: cotizacion, error: cotError } = await insforgeDb()
        .from('cotizaciones')
        .insert([
          {
            folio,
            alumno_id: cliente.alumnoId,
            externo_id: cliente.externoId,
            tipo_cliente: datos.tipo_cliente,
            fecha_cotizacion: new Date().toISOString().split('T')[0],
            fecha_vigencia: datos.fecha_vigencia || null,
            subtotal,
            total,
            observaciones: datos.observaciones || null,
            condiciones_pago: datos.condiciones_pago || '50% anticipo, 50% contra entrega',
            tiempo_entrega: datos.tiempo_entrega || '5-7 días hábiles',
            fecha_entrega: datos.fecha_entrega || null,
            estado: estadoDestino,
            incluir_iva: incluirIva,
            incluir_isr: incluirIsr,
            metodo_pago_id: datos.metodo_pago_id || null,
            forma_pago_id: datos.forma_pago_id || null,
            metodo_pago_pdf: datos.metodo_pago_pdf?.trim() || null,
            forma_pago_pdf: datos.forma_pago_pdf?.trim() || null,
          },
        ])
        .select()
        .single();

      if (cotError) throw cotError;

      const partidas = datos.partidas.map((p, index) => {
        const { ui_key: _uiKey, ...resto } = p;
        return {
          cotizacion_id: cotizacion.id,
          ...resto,
          orden: index + 1,
        };
      });

      const { error: detError } = await insforgeDb().from('detalle_cotizacion').insert(partidas);
      if (detError) throw detError;

      await obtenerCotizaciones();
      return { data: cotizacion, error: null, id: cotizacion.id as string };
    } catch (err) {
      console.error('Error al guardar cotización:', err);
      return { data: null, error: getSupabaseErrorMessage(err), id: cotizacionId };
    }
  };

  /** Auto-guardado mientras se capturan partidas (estado en_proceso). */
  const sincronizarBorradorCotizacion = async (
    cotizacionId: string | null,
    datos: NuevaCotizacion
  ) => guardarCotizacion(cotizacionId, datos, ESTADO_COTIZACION_BORRADOR);

  // Crear cotización
  const crearCotizacion = async (nuevaCotizacion: NuevaCotizacion) => {
    const result = await guardarCotizacion(null, nuevaCotizacion, 'emitido');
    return { data: result.data, error: result.error };
  };

  /** Actualiza cotización existente conservando el mismo folio (regenerar PDF / datos sin nuevo folio). */
  const actualizarCotizacionCompleta = async (cotizacionId: string, datos: NuevaCotizacion) => {
    const result = await guardarCotizacion(cotizacionId, datos, 'emitido');
    return { data: result.data, error: result.error };
  };

  // Actualizar estado de cotización (solo avance: no se puede retroceder en el flujo)
  const actualizarEstado = async (
    id: string,
    estado: 'en_proceso' | 'emitido' | 'aprobado' | 'trabajando' | 'terminado'
  ) => {
    try {
      const { data: row, error: fetchErr } = await insforgeDb()
        .from('cotizaciones')
        .select('estado')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!row?.estado) {
        return { error: 'No se encontró la cotización.' };
      }
      if (!transicionEstadoCotizacionValida(row.estado, estado)) {
        return {
          error: 'No se puede retroceder el estatus: solo se permite avanzar o mantener el actual.',
        };
      }

      const { error } = await insforgeDb()
        .from('cotizaciones')
        .update({ estado })
        .eq('id', id);

      if (error) throw error;
      await obtenerCotizaciones();
      if (estado === 'terminado' && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(REFETCH_PEDIDOS_EVENT));
      }
      return { error: null };
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      return { error: getSupabaseErrorMessage(err) };
    }
  };

  // Actualizar PDF URL
  const actualizarPdfUrl = async (id: string, pdfUrl: string) => {
    try {
      const { error } = await insforgeDb()
        .from('cotizaciones')
        .update({ pdf_url: pdfUrl })
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error al actualizar PDF URL:', err);
      return { error: getSupabaseErrorMessage(err) };
    }
  };

  // Eliminar cotización
  const eliminarCotizacion = async (id: string) => {
    try {
      // Intentar borrar detalle primero (además de depender de ON DELETE CASCADE)
      const { error: detError } = await insforgeDb()
        .from('detalle_cotizacion')
        .delete()
        .eq('cotizacion_id', id);
      if (detError) throw detError;

      const { error } = await insforgeDb()
        .from('cotizaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await obtenerCotizaciones();
      return { error: null };
    } catch (err) {
      console.error('Error al eliminar cotizacion:', err);
      return { error: getSupabaseErrorMessage(err) };
    }
  };

  useEffect(() => {
    if (autoCargar) obtenerCotizaciones();
  }, [obtenerCotizaciones, autoCargar]);

  return {
    cotizaciones,
    cargando,
    error,
    obtenerCotizaciones,
    obtenerCotizacion,
    crearCotizacion,
    sincronizarBorradorCotizacion,
    actualizarCotizacionCompleta,
    actualizarEstado,
    actualizarPdfUrl,
    eliminarCotizacion,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, getSupabaseErrorMessage } from '@/lib/supabase';
import type { Alumno, Cotizacion, DetalleCotizacion, Externo } from '@/lib/types';
import { compareCotizacionesPorFechaCotizacionDesc } from '@/lib/cotizacionesSort';
import { calcularMontosImpuestosCotizacion } from '@/lib/cotizacionesImpuestos';
import { transicionEstadoCotizacionValida } from '@/lib/cotizacionesEstados';
import { isUuid, resolverAlumnoUuidParaCotizacion } from '@/lib/resolverAlumnoCotizacion';
import { mapAlumnoRow } from '@/lib/hooks/useAlumnos';
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

/** Evita embed PostgREST `alumno(*)` cuando el FK no coincide (ej. alumno_id UUID vs tabla `alumno` con bigint). */
async function relacionarClienteParaCotizaciones(
  cotRows: Record<string, unknown>[]
): Promise<Cotizacion[]> {
  const alumnoIds = [
    ...new Set(cotRows.map((r) => r.alumno_id).filter((x) => x != null && x !== '')),
  ].map(String);
  const externoIds = [
    ...new Set(cotRows.map((r) => r.externo_id).filter((x) => x != null && x !== '')),
  ].map(String);

  const alumnoPorId = new Map<string, Alumno>();
  if (alumnoIds.length > 0) {
    const batch = await supabase.from('alumno').select('*').in('alumno_id', alumnoIds);
    if (!batch.error && batch.data) {
      for (const row of batch.data) {
        const m = mapAlumnoRow(row as Record<string, unknown>);
        alumnoPorId.set(String((row as { alumno_id: unknown }).alumno_id), m);
      }
    }
    for (const id of alumnoIds) {
      if (alumnoPorId.has(id)) continue;
      const one = await supabase.from('alumno').select('*').eq('alumno_id', id).maybeSingle();
      if (!one.error && one.data) {
        alumnoPorId.set(id, mapAlumnoRow(one.data as Record<string, unknown>));
      }
    }
  }

  const externoPorId = new Map<string, Externo>();
  if (externoIds.length > 0) {
    const ex = await supabase.from('externos').select('*').in('id', externoIds);
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

      let q = await supabase
        .from('cotizaciones')
        .select('*')
        .order('fecha_cotizacion', { ascending: false });
      if (q.error) {
        q = await supabase.from('cotizaciones').select('*').order('created_at', { ascending: false });
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
      const { data: cotRaw, error: cotError } = await supabase.from('cotizaciones').select('*').eq('id', id).single();

      if (cotError) throw cotError;

      const [cotizacionEnriquecida] = await relacionarClienteParaCotizaciones([
        (cotRaw || {}) as Record<string, unknown>,
      ]);
      const cotizacion = cotizacionEnriquecida;

      const { data: detalle, error: detError } = await supabase
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
      const { data, error } = await supabase.rpc('generar_folio_cotizacion');
      if (error) throw error;
      return data as string;
    } catch (err) {
      console.error('Error al generar folio:', err);
      throw err;
    }
  };

  // Crear cotización
  const crearCotizacion = async (nuevaCotizacion: NuevaCotizacion) => {
    try {
      // 1. Generar folio
      const folio = await generarFolio();

      // 2. Calcular totales (subtotal de partidas + IVA opcional − ISR retención opcional)
      const subtotalPartidas = nuevaCotizacion.partidas.reduce((sum, p) => sum + p.subtotal, 0);
      const incluirIva = nuevaCotizacion.incluir_iva === true;
      const incluirIsr = nuevaCotizacion.incluir_isr === true;
      const { subtotal, total } = calcularMontosImpuestosCotizacion(
        subtotalPartidas,
        incluirIva,
        incluirIsr
      );

      let alumnoId: string | null = nuevaCotizacion.alumno_id ?? null;
      if (nuevaCotizacion.tipo_cliente === 'alumno' && alumnoId) {
        alumnoId = await resolverAlumnoUuidParaCotizacion(
          alumnoId,
          nuevaCotizacion.alumno_referencia,
          nuevaCotizacion.alumno_nombre || ''
        );
      }

      const externoId = nuevaCotizacion.externo_id ?? null;
      if (nuevaCotizacion.tipo_cliente === 'externo' && externoId && !isUuid(externoId)) {
        return {
          data: null,
          error: 'Cliente externo inválido. Vuelve a seleccionar el cliente.',
        };
      }

      // 3. Crear cotización
      const { data: cotizacion, error: cotError } = await supabase
        .from('cotizaciones')
        .insert([{
          folio,
          alumno_id: alumnoId,
          externo_id: externoId,
          tipo_cliente: nuevaCotizacion.tipo_cliente,
          fecha_cotizacion: new Date().toISOString().split('T')[0],
          fecha_vigencia: nuevaCotizacion.fecha_vigencia || null,
          subtotal,
          total,
          observaciones: nuevaCotizacion.observaciones || null,
          condiciones_pago: nuevaCotizacion.condiciones_pago || '50% anticipo, 50% contra entrega',
          tiempo_entrega: nuevaCotizacion.tiempo_entrega || '5-7 días hábiles',
          fecha_entrega: nuevaCotizacion.fecha_entrega || null,
          estado: 'emitido',
          incluir_iva: incluirIva,
          incluir_isr: incluirIsr,
          metodo_pago_id: nuevaCotizacion.metodo_pago_id || null,
          forma_pago_id: nuevaCotizacion.forma_pago_id || null,
        }])
        .select()
        .single();

      if (cotError) throw cotError;

      // 4. Crear partidas
      const partidas = nuevaCotizacion.partidas.map((p, index) => {
        const { ui_key: _uiKey, ...resto } = p;
        return {
          cotizacion_id: cotizacion.id,
          ...resto,
          orden: index + 1,
        };
      });

      const { error: detError } = await supabase
        .from('detalle_cotizacion')
        .insert(partidas);

      if (detError) throw detError;

      await obtenerCotizaciones();
      return { data: cotizacion, error: null };
    } catch (err) {
      console.error('Error al crear cotizacion:', err);
      return { data: null, error: getSupabaseErrorMessage(err) };
    }
  };

  /** Actualiza cotización existente conservando el mismo folio (regenerar PDF / datos sin nuevo folio). */
  const actualizarCotizacionCompleta = async (
    cotizacionId: string,
    datos: NuevaCotizacion
  ) => {
    try {
      const subtotalPartidas = datos.partidas.reduce((sum, p) => sum + p.subtotal, 0);
      const incluirIva = datos.incluir_iva === true;
      const incluirIsr = datos.incluir_isr === true;
      const { subtotal, total } = calcularMontosImpuestosCotizacion(
        subtotalPartidas,
        incluirIva,
        incluirIsr
      );

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
          data: null,
          error: 'Cliente externo inválido. Vuelve a seleccionar el cliente.',
        };
      }

      const { data: cotizacion, error: cotError } = await supabase
        .from('cotizaciones')
        .update({
          alumno_id: datos.tipo_cliente === 'alumno' ? alumnoId : null,
          externo_id: datos.tipo_cliente === 'externo' ? externoId : null,
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
          estado: 'emitido',
        })
        .eq('id', cotizacionId)
        .select()
        .single();

      if (cotError) throw cotError;

      const { error: delErr } = await supabase
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

      const { error: insErr } = await supabase.from('detalle_cotizacion').insert(partidas);
      if (insErr) throw insErr;

      await obtenerCotizaciones();
      return { data: cotizacion, error: null };
    } catch (err) {
      console.error('Error al actualizar cotización completa:', err);
      return { data: null, error: getSupabaseErrorMessage(err) };
    }
  };

  // Actualizar estado de cotización (solo avance: no se puede retroceder en el flujo)
  const actualizarEstado = async (id: string, estado: 'emitido' | 'aprobado' | 'trabajando' | 'terminado') => {
    try {
      const { data: row, error: fetchErr } = await supabase
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

      const { error } = await supabase
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
      const { error } = await supabase
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
      const { error: detError } = await supabase
        .from('detalle_cotizacion')
        .delete()
        .eq('cotizacion_id', id);
      if (detError) throw detError;

      const { error } = await supabase
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
    actualizarCotizacionCompleta,
    actualizarEstado,
    actualizarPdfUrl,
    eliminarCotizacion,
  };
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Check, FileText } from 'lucide-react';
import { useCotizaciones } from '@/lib/hooks/useCotizaciones';
import { supabase } from '@/lib/supabase';
import type { Cotizacion, DetalleCotizacion, Costo } from '@/lib/types';
import {
  compareCotizacionesPorFechaEntrega,
  compareItemsProduccionPorFechaEntrega,
} from '@/lib/cotizacionesSort';
import { getWeekForDate, toISODate } from '@/lib/produccion-semanal-week';

/** Fila guardada en InsForge para esta semana (permite conservar partidas sin reexpandir cotizaciones). */
type PlanItemSemana = {
  detalle_id: string;
  cotizacion_id: string;
  cotizacion_folio: string;
  modelo: string;
  piezas: number;
  precio_unitario: number;
  costo_unitario: number;
};

type SeleccionRow = {
  cotizacion_id: string;
  cotizacion_folio: string;
  detalle_id: string;
  modelo: string;
  piezas: number;
  precio_unitario: number;
  costo_unitario: number;
  ganancia_unitaria: number;
  ganancia_total: number;
};

function rowDesdePlanItemGuardado(p: PlanItemSemana): SeleccionRow {
  const precio = Number(p.precio_unitario) || 0;
  const costo = Number(p.costo_unitario) || 0;
  const piezas = Number(p.piezas) || 0;
  const ganU = Number((precio - costo).toFixed(2));
  const ganT = Number((ganU * piezas).toFixed(2));
  return {
    cotizacion_id: p.cotizacion_id,
    cotizacion_folio: p.cotizacion_folio,
    detalle_id: p.detalle_id,
    modelo: p.modelo,
    piezas,
    precio_unitario: precio,
    costo_unitario: costo,
    ganancia_unitaria: ganU,
    ganancia_total: ganT,
  };
}

export interface ItemProduccion {
  cotizacion_id: string;
  folio: string;
  detalle_id: string;
  modelo: string;
  piezas: number;
  /** Para ordenar listados del módulo por la misma fecha que la cotización */
  fecha_entrega?: string | null;
}

interface ModalProduccionProps {
  onClose: () => void;
  onGuardar: (items: ItemProduccion[]) => void;
}

function formatWeekRange(monday: Date, sunday: Date) {
  return `${monday.getDate()} - ${sunday.getDate()} ${sunday.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`;
}

function fmtFechaCot(fecha: string | null | undefined) {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-MX');
  } catch {
    return '—';
  }
}

export default function ModalProduccion({ onClose, onGuardar }: ModalProduccionProps) {
  const [mounted, setMounted] = useState(false);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [cotizacionExpandida, setCotizacionExpandida] = useState<string | null>(null);
  const [detallesExpandidos, setDetallesExpandidos] = useState<Record<string, DetalleCotizacion[]>>({});
  const [costoPorId, setCostoPorId] = useState<Record<string, Costo>>({});
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [gastosFijosTotal, setGastosFijosTotal] = useState(0);
  const [loadingGastos, setLoadingGastos] = useState(false);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [seleccionGuardadaMsg, setSeleccionGuardadaMsg] = useState<string | null>(null);
  /** detalle_id → fecha_inicio (lunes) de la semana donde ya está en un plan InsForge */
  const [ocupadosGlobal, setOcupadosGlobal] = useState<Record<string, string>>({});
  const [loadingContext, setLoadingContext] = useState(false);
  const [guardandoSeleccion, setGuardandoSeleccion] = useState(false);
  /** Ítems ya persistidos en esta semana (evita perder partidas al guardar solo lo expandido). */
  const [planItemsCache, setPlanItemsCache] = useState<PlanItemSemana[]>([]);

  const { cotizaciones, obtenerCotizacion } = useCotizaciones();

  const { monday, sunday } = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + semanaOffset * 7);
    return getWeekForDate(base);
  }, [semanaOffset]);

  const fechaInicioSemanaActual = useMemo(() => toISODate(monday), [monday]);

  const detalleDisponibleEnEstaSemana = (detalleId: string) => {
    const asignadoA = ocupadosGlobal[detalleId];
    if (!asignadoA) return true;
    return asignadoA === fechaInicioSemanaActual;
  };

  /** Aprobadas (flujo principal) y terminadas (pueden cargarse al plan con las partidas que elijas). */
  const cotizacionesProduccion = useMemo(() => {
    return [...cotizaciones.filter((c) => c.estado === 'aprobado' || c.estado === 'terminado')].sort(
      compareCotizacionesPorFechaEntrega
    );
  }, [cotizaciones]);

  const nombreCliente = (cot: Cotizacion) =>
    cot.alumno?.nombre || cot.externo?.nombre || 'Cliente general';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      setLoadingContext(true);
      try {
        const res = await fetch(`/api/produccion-semanal/context?semanaOffset=${semanaOffset}`);
        const json = await res.json().catch(() => null);
        if (cancelled || !json?.success) return;
        setOcupadosGlobal((json.ocupados as Record<string, string>) || {});
        const rawItems = (json.planItems as PlanItemSemana[] | undefined) || [];
        setPlanItemsCache(rawItems);
        const ids = rawItems.map((x) => x.detalle_id);
        setSeleccionados(new Set(ids));
      } catch {
        if (!cancelled) setOcupadosGlobal({});
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, semanaOffset]);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      setLoadingGastos(true);
      try {
        const res = await fetch('/api/gastos-fijos-semanales/actual');
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudieron cargar gastos fijos');
        const total = (json.gastosGuardados ?? []).reduce((sum: number, g: any) => sum + (Number(g.monto) || 0), 0);
        setGastosFijosTotal(total);
      } catch (e) {
        setGastosFijosTotal(0);
      } finally {
        setLoadingGastos(false);
      }
    })();
  }, [mounted]);

  const handleExpandirCotizacion = async (id: string) => {
    if (cotizacionExpandida === id) {
      setCotizacionExpandida(null);
      return;
    }
    setCotizacionExpandida(id);
    if (!detallesExpandidos[id]) {
      try {
        const { detalle } = await obtenerCotizacion(id);
        setDetallesExpandidos((prev) => ({ ...prev, [id]: detalle }));

        const costoIds = Array.from(
          new Set(
            (detalle as any[])
              .map((d) => d.costo_id)
              .filter((x) => typeof x === 'string' && x.length > 0)
          )
        ) as string[];

        if (costoIds.length > 0) {
          const faltantes = costoIds.filter((cid) => !costoPorId[cid]);
          if (faltantes.length > 0) {
            const { data: costosRows, error: costosErr } = await supabase
              .from('costos')
              .select('*')
              .in('id', faltantes);
            if (!costosErr && costosRows) {
              setCostoPorId((prev) => {
                const next = { ...prev };
                for (const c of costosRows as any[]) next[c.id] = c as Costo;
                return next;
              });
            }
          }
        }
      } catch (e) {
        console.error('Error cargando detalle:', e);
      }
    }
  };

  const toggleSeleccion = (detalle: DetalleCotizacion, cotizacion: Cotizacion) => {
    const key = detalle.id;
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const estaSeleccionado = (detalleId: string) => seleccionados.has(detalleId);

  const seleccionInfo = useMemo(() => {
    const desdeExpandido = new Map<string, SeleccionRow>();
    for (const cot of cotizacionesProduccion) {
      const detalles = detallesExpandidos[cot.id] || [];
      for (const d of detalles as any[]) {
        if (!seleccionados.has(d.id)) continue;
        if (!detalleDisponibleEnEstaSemana(d.id)) continue;
        const precio = Number(d.precio_unitario) || 0;
        const costoId = d.costo_id as string | undefined;
        const costoUnit = costoId && costoPorId[costoId] ? Number((costoPorId[costoId] as any).precio_compra) || 0 : 0;
        const piezas = Number(d.cantidad) || 0;
        const ganU = Number((precio - costoUnit).toFixed(2));
        const ganT = Number((ganU * piezas).toFixed(2));
        desdeExpandido.set(d.id, {
          cotizacion_id: cot.id,
          cotizacion_folio: cot.folio,
          detalle_id: d.id,
          modelo: d.prenda_nombre,
          piezas,
          precio_unitario: precio,
          costo_unitario: costoUnit,
          ganancia_unitaria: ganU,
          ganancia_total: ganT,
        });
      }
    }

    const rows: SeleccionRow[] = [];
    for (const detalleId of seleccionados) {
      if (!detalleDisponibleEnEstaSemana(detalleId)) continue;
      const exp = desdeExpandido.get(detalleId);
      if (exp) {
        rows.push(exp);
        continue;
      }
      const cached = planItemsCache.find((p) => p.detalle_id === detalleId);
      if (cached) rows.push(rowDesdePlanItemGuardado(cached));
    }

    const gananciasTotal = rows.reduce((s, r) => s + r.ganancia_total, 0);
    return { rows, gananciasTotal };
  }, [
    cotizacionesProduccion,
    detallesExpandidos,
    seleccionados,
    costoPorId,
    ocupadosGlobal,
    fechaInicioSemanaActual,
    planItemsCache,
  ]);

  const minimoAlcanzado = seleccionInfo.gananciasTotal >= gastosFijosTotal && gastosFijosTotal > 0;

  /** 0–100 % del mínimo (gastos fijos); solo para barra y etiqueta, sin mostrar pesos. */
  const progresoPct =
    gastosFijosTotal > 0
      ? Math.min(100, (seleccionInfo.gananciasTotal / gastosFijosTotal) * 100)
      : 0;

  const handleGuardar = () => {
    const porCot = new Map(cotizacionesProduccion.map((c) => [c.id, c] as const));
    const items: ItemProduccion[] = seleccionInfo.rows.map((r) => {
      const cot = porCot.get(r.cotizacion_id);
      return {
        cotizacion_id: r.cotizacion_id,
        folio: r.cotizacion_folio,
        detalle_id: r.detalle_id,
        modelo: r.modelo,
        piezas: r.piezas,
        fecha_entrega: cot?.fecha_entrega,
      };
    });
    items.sort(compareItemsProduccionPorFechaEntrega);
    onGuardar(items);
  };

  const handleGuardarSeleccion = async () => {
    setGuardandoSeleccion(true);
    setSeleccionGuardadaMsg(null);
    setError(null);
    setSuccess(null);
    try {
      const itemsPayload = seleccionInfo.rows.map((r) => ({
        cotizacion_id: r.cotizacion_id,
        cotizacion_folio: r.cotizacion_folio,
        detalle_id: r.detalle_id,
        modelo: r.modelo,
        piezas: r.piezas,
        precio_unitario: r.precio_unitario,
        costo_unitario: r.costo_unitario,
      }));

      const res = await fetch('/api/produccion-semanal/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semanaOffset,
          gastos_fijos_total: Number(gastosFijosTotal.toFixed(2)),
          ganancias_total: Number(seleccionInfo.gananciasTotal.toFixed(2)),
          estado: 'BORRADOR',
          items: itemsPayload,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo guardar la selección');

      const ctxRes = await fetch(`/api/produccion-semanal/context?semanaOffset=${semanaOffset}`);
      const ctx = await ctxRes.json().catch(() => null);
      if (ctx?.success) {
        setOcupadosGlobal((ctx.ocupados as Record<string, string>) || {});
        const rawItems = (ctx.planItems as PlanItemSemana[] | undefined) || [];
        setPlanItemsCache(rawItems);
        setSeleccionados(new Set(rawItems.map((x) => x.detalle_id)));
      }

      handleGuardar();
      setSeleccionGuardadaMsg(
        itemsPayload.length === 0
          ? 'Plan de esta semana vaciado.'
          : 'Selección guardada para esta semana. Ya no aparecerá en otras semanas.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardandoSeleccion(false);
    }
  };

  const handleGenerarPlan = async () => {
    setGuardandoPlan(true);
    setError(null);
    setSuccess(null);
    try {
      if (!minimoAlcanzado) return;
      const payload = {
        semanaOffset,
        gastos_fijos_total: Number(gastosFijosTotal.toFixed(2)),
        ganancias_total: Number(seleccionInfo.gananciasTotal.toFixed(2)),
        estado: 'GENERADO' as const,
        items: seleccionInfo.rows.map((r) => ({
          cotizacion_id: r.cotizacion_id,
          cotizacion_folio: r.cotizacion_folio,
          detalle_id: r.detalle_id,
          modelo: r.modelo,
          piezas: r.piezas,
          precio_unitario: r.precio_unitario,
          costo_unitario: r.costo_unitario,
        })),
      };

      const res = await fetch('/api/produccion-semanal/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo guardar el plan');

      setSuccess('Plan generado y guardado.');
      handleGuardar();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar plan');
    } finally {
      setGuardandoPlan(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: 'min(960px, 100vw - 1.5rem)',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)' }}>Producción semanal</h2>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.4 }}>
                Cotizaciones <strong>aprobadas</strong> y <strong>terminadas</strong> (orden: fecha de entrega). Expande
                una cotización y elige las partidas. Puedes guardar aunque no alcances el mínimo; si llegan más
                cotizaciones en la semana, añade partidas y vuelve a guardar: se suman al plan de esta semana.
              </p>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              padding: '0.5rem 0',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <button
              type="button"
              onClick={() => setSemanaOffset((s) => s - 1)}
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={20} />
              Anterior
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' }}>
              Semana {formatWeekRange(monday, sunday)}
            </span>
            <button
              type="button"
              onClick={() => setSemanaOffset((s) => s + 1)}
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              aria-label="Semana siguiente"
            >
              Siguiente
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          {cotizacionesProduccion.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              No hay cotizaciones en estado <strong>Aprobado</strong> o <strong>Terminado</strong>. Cambia el estatus en
              el historial de cotizaciones.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {cotizacionesProduccion.map((cot) => (
                <div
                  key={cot.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleExpandirCotizacion(cot.id)}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      background: cotizacionExpandida === cot.id ? '#f9fafb' : '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      fontSize: '0.95rem',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <FileText size={20} color="#6366f1" />
                      <strong>{cot.folio}</strong>
                      <span style={{ color: '#374151', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {nombreCliente(cot)}
                      </span>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          background: cot.estado === 'aprobado' ? '#dbeafe' : '#f3f4f6',
                          color: cot.estado === 'aprobado' ? '#1d4ed8' : '#4b5563',
                        }}
                      >
                        {cot.estado === 'aprobado' ? 'Aprobado' : 'Terminado'}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        Entrega: {fmtFechaCot(cot.fecha_entrega)}
                      </span>
                    </span>
                    <ChevronRight
                      size={20}
                      style={{
                        transform: cotizacionExpandida === cot.id ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {cotizacionExpandida === cot.id && (
                    <div style={{ padding: '0 0.75rem 1rem', borderTop: '1px solid #f3f4f6' }}>
                      {!detallesExpandidos[cot.id] ? (
                        <p style={{ padding: '1rem', color: '#6b7280' }}>Cargando conceptos...</p>
                      ) : (() => {
                        const detallesRaw = detallesExpandidos[cot.id] || [];
                        const detallesMostrar = detallesRaw.filter((d) => detalleDisponibleEnEstaSemana(d.id));
                        if (detallesMostrar.length === 0) {
                          return (
                            <p style={{ padding: '1rem 0', color: '#6b7280', fontSize: '0.9rem' }}>
                              {detallesRaw.length === 0
                                ? 'Sin conceptos en esta cotización.'
                                : 'Todas las partidas ya están en el plan de otra semana.'}
                            </p>
                          );
                        }
                        return (
                        <div style={{ paddingTop: '0.75rem', overflowX: 'auto' }}>
                          <table
                            style={{
                              width: '100%',
                              minWidth: '560px',
                              borderCollapse: 'collapse',
                              fontSize: '0.85rem',
                            }}
                          >
                            <thead>
                              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem', width: 36 }} aria-label="Seleccionar" />
                                <th style={{ padding: '0.5rem' }}>Cliente</th>
                                <th style={{ padding: '0.5rem' }}>Modelo</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Piezas</th>
                                <th style={{ padding: '0.5rem' }}>Fecha entrega</th>
                                <th style={{ padding: '0.5rem' }}>Tiempo entrega</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detallesMostrar.map((d) => {
                                const sel = estaSeleccionado(d.id);
                                return (
                                  <tr
                                    key={d.id}
                                    style={{
                                      background: sel ? '#ecfdf5' : '#fff',
                                      borderBottom: '1px solid #f3f4f6',
                                    }}
                                  >
                                    <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                      <input
                                        type="checkbox"
                                        checked={sel}
                                        onChange={() => toggleSeleccion(d, cot)}
                                        aria-label={`Seleccionar ${d.prenda_nombre}`}
                                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                      {nombreCliente(cot)}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                      <strong>{d.prenda_nombre}</strong>
                                      {d.talla ? ` · ${d.talla}` : ''}
                                      {d.color ? ` · ${d.color}` : ''}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', verticalAlign: 'middle' }}>
                                      {d.cantidad}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                      {fmtFechaCot(cot.fecha_entrega)}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                      {cot.tiempo_entrega || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e5e7eb',
            background: '#fafafa',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1f2937', letterSpacing: '0.02em' }}>
            {seleccionInfo.rows.length} concepto{seleccionInfo.rows.length !== 1 ? 's' : ''} seleccionado
            {seleccionInfo.rows.length !== 1 ? 's' : ''}
          </p>
          {!loadingGastos && gastosFijosTotal > 0 && (
            <div
              style={{ marginTop: '0.85rem', maxWidth: 'min(100%, 340px)', marginLeft: 'auto', marginRight: 'auto' }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progresoPct)}
              aria-label="Porcentaje de avance hacia el mínimo semanal"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.02em' }}>
                  Avance hacia el mínimo
                </span>
                <span
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: minimoAlcanzado ? '#047857' : '#d97706',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(progresoPct)}%
                </span>
              </div>
              <div
                style={{
                  height: 12,
                  background: '#e5e7eb',
                  borderRadius: 999,
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    width: `${progresoPct}%`,
                    height: '100%',
                    background: minimoAlcanzado ? '#10b981' : '#f59e0b',
                    transition: 'width 0.35s ease',
                  }}
                />
              </div>
            </div>
          )}
          {loadingGastos && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Validando…</p>
          )}
          {seleccionGuardadaMsg && (
            <p style={{ margin: '0.65rem 0 0', fontSize: '0.85rem', color: '#0369a1' }}>{seleccionGuardadaMsg}</p>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 'min(100%, 280px)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: minimoAlcanzado ? '#047857' : '#b91c1c' }}>
              {loadingGastos ? (
                'Validando…'
              ) : gastosFijosTotal <= 0 ? (
                'Configura gastos fijos semanales para poder generar el plan'
              ) : minimoAlcanzado ? (
                'Mínimo alcanzado'
              ) : (
                'Aún no alcanzas el mínimo de ganancias para cubrir gastos fijos semanales'
              )}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGuardarSeleccion}
              disabled={loadingContext || guardandoSeleccion}
            >
              {guardandoSeleccion ? 'Guardando…' : 'Guardar selección'}
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleGenerarPlan}
              disabled={!minimoAlcanzado || guardandoPlan}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Check size={18} />
              {guardandoPlan ? 'Generando...' : 'Generar plan de trabajo'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.9rem', padding: '0 1.5rem 1rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop: '0.5rem', color: '#047857', fontSize: '0.9rem', padding: '0 1.5rem 1rem' }}>
            {success}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

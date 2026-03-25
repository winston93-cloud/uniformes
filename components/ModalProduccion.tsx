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

function getWeekForDate(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
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

  const { cotizaciones, obtenerCotizacion } = useCotizaciones();

  const { monday, sunday } = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + semanaOffset * 7);
    return getWeekForDate(base);
  }, [semanaOffset]);

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
    const rows: Array<{
      cotizacion_id: string;
      cotizacion_folio: string;
      detalle_id: string;
      modelo: string;
      piezas: number;
      precio_unitario: number;
      costo_unitario: number;
      ganancia_unitaria: number;
      ganancia_total: number;
    }> = [];

    for (const cot of cotizacionesProduccion) {
      const detalles = detallesExpandidos[cot.id] || [];
      for (const d of detalles as any[]) {
        if (!seleccionados.has(d.id)) continue;
        const precio = Number(d.precio_unitario) || 0;
        const costoId = d.costo_id as string | undefined;
        const costoUnit = costoId && costoPorId[costoId] ? Number((costoPorId[costoId] as any).precio_compra) || 0 : 0;
        const piezas = Number(d.cantidad) || 0;
        const ganU = Number((precio - costoUnit).toFixed(2));
        const ganT = Number((ganU * piezas).toFixed(2));
        rows.push({
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

    const gananciasTotal = rows.reduce((s, r) => s + r.ganancia_total, 0);
    return { rows, gananciasTotal };
  }, [cotizacionesProduccion, detallesExpandidos, seleccionados, costoPorId]);

  const minimoAlcanzado = seleccionInfo.gananciasTotal >= gastosFijosTotal && gastosFijosTotal > 0;

  const handleGuardar = () => {
    const items: ItemProduccion[] = [];
    cotizacionesProduccion.forEach((cot) => {
      const detalles = detallesExpandidos[cot.id] || [];
      detalles.forEach((d) => {
        if (seleccionados.has(d.id)) {
          items.push({
            cotizacion_id: cot.id,
            folio: cot.folio,
            detalle_id: d.id,
            modelo: d.prenda_nombre,
            piezas: d.cantidad,
            fecha_entrega: cot.fecha_entrega,
          });
        }
      });
    });
    items.sort(compareItemsProduccionPorFechaEntrega);
    onGuardar(items);
  };

  const handleGuardarSeleccion = () => {
    setSeleccionGuardadaMsg(null);
    setError(null);
    setSuccess(null);
    if (seleccionados.size === 0) {
      setSeleccionGuardadaMsg('No hay partidas seleccionadas. Marca al menos una fila.');
      return;
    }
    handleGuardar();
    setSeleccionGuardadaMsg('Selección guardada. Puedes generar el plan cuando el mínimo esté en verde.');
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
                una cotización y elige las partidas para el plan.
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
                      ) : (
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
                              {detallesExpandidos[cot.id].map((d) => {
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
                      )}
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
            {seleccionados.size} concepto{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </p>
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
            <button type="button" className="btn btn-primary" onClick={handleGuardarSeleccion}>
              Guardar selección
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

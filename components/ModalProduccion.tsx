'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Check, FileText } from 'lucide-react';
import { useCotizaciones } from '@/lib/hooks/useCotizaciones';
import type { Cotizacion, DetalleCotizacion } from '@/lib/types';

export interface ItemProduccion {
  cotizacion_id: string;
  folio: string;
  detalle_id: string;
  modelo: string;
  piezas: number;
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

export default function ModalProduccion({ onClose, onGuardar }: ModalProduccionProps) {
  const [mounted, setMounted] = useState(false);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [cotizacionExpandida, setCotizacionExpandida] = useState<string | null>(null);
  const [detallesExpandidos, setDetallesExpandidos] = useState<Record<string, DetalleCotizacion[]>>({});
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const { cotizaciones, obtenerCotizacion } = useCotizaciones();

  const { monday, sunday } = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + semanaOffset * 7);
    return getWeekForDate(base);
  }, [semanaOffset]);

  const cotizacionesAceptadas = useMemo(() => {
    return cotizaciones
      .filter((c) => c.estado === 'aceptada')
      .sort((a, b) => {
        const fa = a.fecha_vigencia || a.fecha_cotizacion || '9999-12-31';
        const fb = b.fecha_vigencia || b.fecha_cotizacion || '9999-12-31';
        return fa.localeCompare(fb);
      });
  }, [cotizaciones]);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleGuardar = () => {
    const items: ItemProduccion[] = [];
    cotizacionesAceptadas.forEach((cot) => {
      const detalles = detallesExpandidos[cot.id] || [];
      detalles.forEach((d) => {
        if (seleccionados.has(d.id)) {
          items.push({
            cotizacion_id: cot.id,
            folio: cot.folio,
            detalle_id: d.id,
            modelo: d.prenda_nombre,
            piezas: d.cantidad,
          });
        }
      });
    });
    onGuardar(items);
    onClose();
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '720px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con navegación de semana */}
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Producción — Cotizaciones aprobadas</h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
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
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>
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
          {cotizacionesAceptadas.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              No hay cotizaciones aprobadas.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {cotizacionesAceptadas.map((cot) => (
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
                      padding: '1rem 1.25rem',
                      background: cotizacionExpandida === cot.id ? '#f9fafb' : '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      fontSize: '1rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={20} color="#6366f1" />
                      <strong>{cot.folio}</strong>
                      <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        — {cot.fecha_vigencia ? new Date(cot.fecha_vigencia).toLocaleDateString('es-MX') : 'Sin fecha'}
                      </span>
                    </span>
                    <ChevronRight
                      size={20}
                      style={{
                        transform: cotizacionExpandida === cot.id ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </button>

                  {cotizacionExpandida === cot.id && (
                    <div style={{ padding: '0 1.25rem 1rem', borderTop: '1px solid #f3f4f6' }}>
                      {!detallesExpandidos[cot.id] ? (
                        <p style={{ padding: '1rem', color: '#6b7280' }}>Cargando conceptos...</p>
                      ) : (
                        <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {detallesExpandidos[cot.id].map((d) => (
                            <label
                              key={d.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                background: estaSeleccionado(d.id) ? '#ecfdf5' : '#f9fafb',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                border: estaSeleccionado(d.id) ? '2px solid #10b981' : '2px solid transparent',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={estaSeleccionado(d.id)}
                                onChange={() => toggleSeleccion(d, cot)}
                                style={{ width: 20, height: 20 }}
                              />
                              <span style={{ flex: 1 }}>
                                <strong>{d.prenda_nombre}</strong> — {d.talla}
                                {d.color ? ` · ${d.color}` : ''}
                              </span>
                              <span style={{ fontWeight: 600, color: '#374151' }}>
                                {d.cantidad} pzs
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            {seleccionados.size} concepto{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleGuardar}
              disabled={seleccionados.size === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Check size={18} />
              Guardar y ver dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

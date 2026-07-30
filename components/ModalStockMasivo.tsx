'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Costo } from '@/lib/types';
import { sortCostosPorTalla } from '@/lib/ordenTallas';
import {
  formatearSignedEnteroAlEscribir,
  parseSignedEnteroFormateado,
} from '@/lib/formatNumericInput';

interface FilaStock {
  costoId: string;
  tallaNombre: string;
  stock: number;
  selected: boolean;
}

interface ModalStockMasivoProps {
  abierto: boolean;
  prendaNombre: string;
  prendaCodigo?: string | null;
  costos: Costo[];
  guardando?: boolean;
  onClose: () => void;
  onAplicar: (
    ajustes: Array<{ id: string; stockActual: number; delta: number; stockNuevo: number }>
  ) => Promise<{ ok: boolean; error?: string }>;
}

export default function ModalStockMasivo({
  abierto,
  prendaNombre,
  prendaCodigo,
  costos,
  guardando = false,
  onClose,
  onAplicar,
}: ModalStockMasivoProps) {
  const [filas, setFilas] = useState<FilaStock[]>([]);
  const [deltaRaw, setDeltaRaw] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setMensaje(null);
    setDeltaRaw('');
    setFilas(
      sortCostosPorTalla(costos).map((c) => ({
        costoId: c.id,
        tallaNombre: c.talla?.nombre || '—',
        stock: Math.max(0, Math.round(Number(c.stock ?? 0))),
        selected: false,
      }))
    );
  }, [abierto, costos]);

  const seleccionadas = useMemo(() => filas.filter((f) => f.selected), [filas]);
  const todasSeleccionadas = filas.length > 0 && seleccionadas.length === filas.length;
  const delta = parseSignedEnteroFormateado(deltaRaw);

  const toggleTodas = () => {
    const next = !todasSeleccionadas;
    setFilas((prev) => prev.map((f) => ({ ...f, selected: next })));
  };

  const toggleFila = (costoId: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.costoId === costoId ? { ...f, selected: !f.selected } : f))
    );
  };

  const previewNegativo = useMemo(() => {
    if (delta >= 0 || seleccionadas.length === 0) return [] as string[];
    return seleccionadas
      .filter((f) => f.stock + delta < 0)
      .map((f) => `${f.tallaNombre} (hay ${f.stock})`);
  }, [delta, seleccionadas]);

  const handleAplicar = async () => {
    setMensaje(null);
    if (seleccionadas.length === 0) {
      setMensaje({ tipo: 'err', text: 'Selecciona al menos una talla.' });
      return;
    }
    if (delta === 0) {
      setMensaje({ tipo: 'err', text: 'Indica una cantidad distinta de 0 (usa − para restar).' });
      return;
    }
    if (previewNegativo.length > 0) {
      setMensaje({
        tipo: 'err',
        text: `El stock no puede quedar negativo en: ${previewNegativo.join(', ')}.`,
      });
      return;
    }

    const ajustes = seleccionadas.map((f) => ({
      id: f.costoId,
      stockActual: f.stock,
      delta,
      stockNuevo: f.stock + delta,
    }));

    const result = await onAplicar(ajustes);
    if (result.ok) {
      setMensaje({
        tipo: 'ok',
        text: `✓ Stock ${delta > 0 ? 'sumado' : 'restado'} en ${ajustes.length} talla(s).`,
      });
      setTimeout(() => onClose(), 1000);
    } else {
      setMensaje({ tipo: 'err', text: result.error || 'Error al actualizar stock.' });
    }
  };

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={guardando ? undefined : onClose}
    >
      <div
        className="form-container"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'min(92vh, 880px)',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            margin: '-1.5rem -1.5rem 0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 600, letterSpacing: '0.04em' }}>
                STOCK MASIVO
              </div>
              <h2 style={{ margin: '0.35rem 0 0', fontSize: '1.45rem', fontWeight: 800 }}>
                {prendaNombre}
              </h2>
              {prendaCodigo ? (
                <div style={{ marginTop: '0.25rem', opacity: 0.9, fontSize: '0.9rem' }}>{prendaCodigo}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '0.35rem 0.65rem',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
              }}
              onClick={onClose}
              disabled={guardando}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '1.25rem 0 0',
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '1rem',
              borderRadius: 12,
              background:
                'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.95rem' }}>
              Ajuste para tallas seleccionadas
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Número positivo suma; con signo − resta (ej. stock 10 y pones −3 → quedan 7 en cada talla
              marcada).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0369a1' }}>
                  Cantidad (+ / −)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  value={deltaRaw}
                  onChange={(e) => {
                    setDeltaRaw(formatearSignedEnteroAlEscribir(e.target.value));
                    setMensaje(null);
                  }}
                  placeholder="Ej: 5 o -5"
                  disabled={guardando}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.55rem' }}
                />
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', paddingBottom: '0.55rem' }}>
                {seleccionadas.length} talla(s) · delta {delta > 0 ? `+${delta}` : String(delta)}
              </div>
            </div>
          </div>

          <div style={{ overflow: 'auto', flex: 1, marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.75rem', width: 44 }}>
                    <input
                      type="checkbox"
                      checked={todasSeleccionadas}
                      onChange={toggleTodas}
                      disabled={filas.length === 0 || guardando}
                      title="Seleccionar / deseleccionar todo"
                      aria-label="Seleccionar o deseleccionar todas las tallas"
                    />
                  </th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Talla</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Stock actual</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Quedaría</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8' }}>
                      Esta prenda no tiene tallas con costo en tu sucursal.
                    </td>
                  </tr>
                ) : (
                  filas.map((f) => {
                    const quedaria = f.selected && delta !== 0 ? f.stock + delta : null;
                    const malo = quedaria != null && quedaria < 0;
                    return (
                      <tr
                        key={f.costoId}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: f.selected ? 'rgba(14, 165, 233, 0.06)' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <input
                            type="checkbox"
                            checked={f.selected}
                            onChange={() => toggleFila(f.costoId)}
                            disabled={guardando}
                          />
                        </td>
                        <td
                          style={{
                            padding: '0.55rem 0.75rem',
                            fontWeight: f.selected ? 600 : 400,
                            color: f.selected ? '#0369a1' : undefined,
                          }}
                        >
                          {f.tallaNombre}
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>
                          {f.stock.toLocaleString('es-MX')}
                        </td>
                        <td
                          style={{
                            padding: '0.55rem 0.75rem',
                            textAlign: 'right',
                            color: malo ? '#dc2626' : quedaria != null ? '#059669' : '#94a3b8',
                            fontWeight: quedaria != null ? 600 : 400,
                          }}
                        >
                          {quedaria == null ? '—' : quedaria.toLocaleString('es-MX')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {mensaje && (
            <p
              style={{
                margin: '0 0 0.75rem',
                color: mensaje.tipo === 'ok' ? '#059669' : '#dc2626',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              {mensaje.text}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleAplicar()}
              disabled={guardando || filas.length === 0}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                border: 'none',
              }}
            >
              {guardando ? 'Aplicando…' : 'Aplicar ajuste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

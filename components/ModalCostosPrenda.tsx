'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Costo } from '@/lib/types';
import { sortCostosPorTalla } from '@/lib/ordenTallas';

function parsePrecio(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

interface FilaCostoEditable {
  costoId: string;
  tallaId: string;
  tallaNombre: string;
  mayoreo: string;
  menudeo: string;
  selected: boolean;
}

interface ModalCostosPrendaProps {
  abierto: boolean;
  prendaNombre: string;
  prendaCodigo?: string | null;
  costos: Costo[];
  guardando?: boolean;
  onClose: () => void;
  onGuardar: (
    cambios: Array<{ id: string; precio_mayoreo: number; precio_menudeo: number; precio_venta: number }>
  ) => Promise<{ ok: boolean; error?: string }>;
  onEliminarTalla?: (
    costoId: string,
    tallaNombre: string
  ) => Promise<{ ok: boolean; error?: string; info?: string }>;
}

export default function ModalCostosPrenda({
  abierto,
  prendaNombre,
  prendaCodigo,
  costos,
  guardando = false,
  onClose,
  onGuardar,
  onEliminarTalla,
}: ModalCostosPrendaProps) {
  const [filas, setFilas] = useState<FilaCostoEditable[]>([]);
  const [bulkMayoreo, setBulkMayoreo] = useState('');
  const [bulkMenudeo, setBulkMenudeo] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setMensaje(null);
    setBulkMayoreo('');
    setBulkMenudeo('');
    setFilas(
      sortCostosPorTalla(costos).map((c) => ({
        costoId: c.id,
        tallaId: c.talla_id,
        tallaNombre: c.talla?.nombre || '—',
        mayoreo: String(c.precio_mayoreo ?? 0),
        menudeo: String(c.precio_menudeo ?? 0),
        selected: false,
      }))
    );
  }, [abierto, costos]);

  const seleccionadas = useMemo(() => filas.filter((f) => f.selected), [filas]);
  const todasSeleccionadas = filas.length > 0 && seleccionadas.length === filas.length;

  const toggleTodas = () => {
    const next = !todasSeleccionadas;
    setFilas((prev) => prev.map((f) => ({ ...f, selected: next })));
  };

  const toggleFila = (costoId: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.costoId === costoId ? { ...f, selected: !f.selected } : f))
    );
  };

  const actualizarFila = (costoId: string, campo: 'mayoreo' | 'menudeo', valor: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.costoId === costoId ? { ...f, [campo]: valor } : f))
    );
  };

  const aplicarBulk = (campo: 'mayoreo' | 'menudeo') => {
    const valor = campo === 'mayoreo' ? bulkMayoreo : bulkMenudeo;
    if (valor === '') {
      setMensaje({ tipo: 'err', text: 'Escribe un precio antes de aplicar.' });
      return;
    }
    if (seleccionadas.length === 0) {
      setMensaje({ tipo: 'err', text: 'Selecciona al menos una talla.' });
      return;
    }
    const ids = new Set(seleccionadas.map((s) => s.costoId));
    setFilas((prev) =>
      prev.map((f) => (ids.has(f.costoId) ? { ...f, [campo]: valor } : f))
    );
    setMensaje({
      tipo: 'ok',
      text: `${campo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'} aplicado a ${seleccionadas.length} talla(s).`,
    });
  };

  const handleGuardar = async () => {
    setMensaje(null);
    const original = new Map(
      sortCostosPorTalla(costos).map((c) => [
        c.id,
        { mayoreo: c.precio_mayoreo ?? 0, menudeo: c.precio_menudeo ?? 0 },
      ])
    );
    const cambios = filas
      .filter((f) => {
        const orig = original.get(f.costoId);
        if (!orig) return true;
        return (
          parsePrecio(f.mayoreo) !== orig.mayoreo || parsePrecio(f.menudeo) !== orig.menudeo
        );
      })
      .map((f) => ({
        id: f.costoId,
        precio_mayoreo: parsePrecio(f.mayoreo),
        precio_menudeo: parsePrecio(f.menudeo),
        precio_venta: parsePrecio(f.menudeo),
      }));

    if (cambios.length === 0) {
      setMensaje({ tipo: 'ok', text: 'No hay cambios que guardar.' });
      return;
    }

    const result = await onGuardar(cambios);
    if (result.ok) {
      setMensaje({ tipo: 'ok', text: `✓ ${cambios.length} talla(s) actualizada(s).` });
      setTimeout(() => onClose(), 1200);
    } else {
      setMensaje({ tipo: 'err', text: result.error || 'Error al guardar.' });
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
      onClick={onClose}
    >
      <div
        className="form-container"
        style={{
          width: 'min(920px, 100%)',
          maxHeight: 'min(92vh, 880px)',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            margin: '-1.5rem -1.5rem 0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 600, letterSpacing: '0.04em' }}>
                PRECIOS POR TALLA
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
              style={{ padding: '0.35rem 0.65rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: '1.25rem 0 0', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '1rem',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.65rem', fontSize: '0.95rem' }}>
              ⚡ Aplicar precio a varias tallas
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Marca las tallas abajo, escribe el precio y pulsa aplicar. Ideal cuando varias tallas comparten el mismo
              mayoreo o menudeo.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb' }}>📦 Mayoreo</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-input"
                    value={bulkMayoreo}
                    onChange={(e) => setBulkMayoreo(e.target.value)}
                    placeholder="0.00"
                    style={{ flex: 1, padding: '0.5rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                    onClick={() => aplicarBulk('mayoreo')}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#059669' }}>🛍️ Menudeo</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-input"
                    value={bulkMenudeo}
                    onChange={(e) => setBulkMenudeo(e.target.value)}
                    placeholder="0.00"
                    style={{ flex: 1, padding: '0.5rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      padding: '0.5rem 0.75rem',
                      whiteSpace: 'nowrap',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                    }}
                    onClick={() => aplicarBulk('menudeo')}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '0.65rem', fontSize: '0.82rem', color: '#64748b' }}>
              {seleccionadas.length > 0
                ? `${seleccionadas.length} talla(s) seleccionada(s)`
                : 'Ninguna talla seleccionada — marca checkboxes en la tabla'}
            </div>
          </div>

          {mensaje ? (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 8,
                fontSize: '0.88rem',
                background: mensaje.tipo === 'ok' ? '#ecfdf5' : '#fef2f2',
                color: mensaje.tipo === 'ok' ? '#065f46' : '#991b1b',
                border: `1px solid ${mensaje.tipo === 'ok' ? '#a7f3d0' : '#fecaca'}`,
              }}
            >
              {mensaje.text}
            </div>
          ) : null}

          <div
            style={{
              flex: 1,
              overflow: 'auto',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              borderRadius: 12,
              background: 'rgba(248, 250, 252, 0.8)',
            }}
          >
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  {onEliminarTalla ? <th style={{ width: 90 }} /> : null}
                  <th style={{ width: 44 }}>
                    <input
                      type="checkbox"
                      checked={todasSeleccionadas}
                      onChange={toggleTodas}
                      aria-label="Seleccionar todas las tallas"
                    />
                  </th>
                  <th>Talla</th>
                  <th>📦 Mayoreo</th>
                  <th>🛍️ Menudeo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.costoId} style={{ background: fila.selected ? 'rgba(249, 115, 22, 0.06)' : undefined }}>
                    {onEliminarTalla ? (
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem' }}
                          onClick={async () => {
                            if (
                              !confirm(
                                `¿Eliminar costo de talla ${fila.tallaNombre}? Esta acción no se puede deshacer.`
                              )
                            ) {
                              return;
                            }
                            const r = await onEliminarTalla(fila.costoId, fila.tallaNombre);
                            if (r.ok) {
                              setFilas((prev) => prev.filter((x) => x.costoId !== fila.costoId));
                              if (r.info) {
                                setMensaje({ tipo: 'ok', text: r.info });
                              }
                            } else {
                              setMensaje({ tipo: 'err', text: r.error || 'No se pudo eliminar.' });
                            }
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    ) : null}
                    <td>
                      <input
                        type="checkbox"
                        checked={fila.selected}
                        onChange={() => toggleFila(fila.costoId)}
                        aria-label={`Seleccionar talla ${fila.tallaNombre}`}
                      />
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.9rem' }}>
                        {fila.tallaNombre}
                      </span>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-input"
                        value={fila.mayoreo}
                        onChange={(e) => actualizarFila(fila.costoId, 'mayoreo', e.target.value)}
                        style={{ maxWidth: 120, padding: '0.45rem 0.5rem', fontWeight: 600, color: '#2563eb' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-input"
                        value={fila.menudeo}
                        onChange={(e) => actualizarFila(fila.costoId, 'menudeo', e.target.value)}
                        style={{ maxWidth: 120, padding: '0.45rem 0.5rem', fontWeight: 600, color: '#059669' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 2, background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
              onClick={() => void handleGuardar()}
              disabled={guardando}
            >
              {guardando ? '⏳ Guardando…' : '💾 Guardar todos los precios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function resumenRangoPrecios(costos: Costo[], campo: 'precio_mayoreo' | 'precio_menudeo'): string {
  if (!costos.length) return '—';
  const vals = costos.map((c) => Number(c[campo] ?? 0));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
}

export function agruparCostosPorPrenda(costos: Costo[]) {
  const map = new Map<string, Costo[]>();
  for (const c of costos.filter((row) => row.activo !== false)) {
    const list = map.get(c.prenda_id) || [];
    list.push(c);
    map.set(c.prenda_id, list);
  }
  return Array.from(map.entries())
    .map(([prenda_id, lista]) => ({
      prenda_id,
      prenda: lista[0]?.prenda,
      costos: sortCostosPorTalla(lista),
    }))
    .sort((a, b) =>
      (a.prenda?.nombre || '').localeCompare(b.prenda?.nombre || '', 'es', { sensitivity: 'base' })
    );
}

'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

export type PartidaPendienteCompletar = {
  id: string;
  prenda_id: string;
  talla_id: string;
  prenda_nombre: string;
  talla_nombre: string;
  pendiente: number;
  cantidad: number;
  especificaciones?: string;
  /** Stock actual en la sucursal del pedido. */
  stock?: number;
  costo_id?: string;
};

export type ItemCompletar = { id: string; cantidad: number };

type Props = {
  abierto: boolean;
  folio?: string | null;
  clienteNombre?: string;
  partidas: PartidaPendienteCompletar[];
  cargando?: boolean;
  guardando?: boolean;
  onClose: () => void;
  onConfirmar: (items: ItemCompletar[]) => void | Promise<void>;
  /** Abre modal para meter stock a esa prenda/talla. */
  onAgregarStock?: (partida: PartidaPendienteCompletar) => void;
};

function maxEntregable(p: PartidaPendienteCompletar): number {
  const stock = Math.max(0, Math.floor(Number(p.stock) || 0));
  const pend = Math.max(0, Math.floor(Number(p.pendiente) || 0));
  return Math.min(pend, stock);
}

export default function ModalCompletarPendientes({
  abierto,
  folio,
  clienteNombre,
  partidas,
  cargando = false,
  guardando = false,
  onClose,
  onConfirmar,
  onAgregarStock,
}: Props) {
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!abierto) return;
    const initSel: Record<string, boolean> = {};
    const initCant: Record<string, string> = {};
    for (const p of partidas) {
      const max = maxEntregable(p);
      // Solo marca por defecto si hay stock para entregar
      initSel[p.id] = max > 0;
      initCant[p.id] = String(max > 0 ? max : p.pendiente);
    }
    setSeleccionados(initSel);
    setCantidades(initCant);
  }, [abierto, partidas]);

  const cantidadValida = (p: PartidaPendienteCompletar): number => {
    const max = maxEntregable(p);
    if (max <= 0) return 0;
    const n = Math.floor(Number(cantidades[p.id]));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, max);
  };

  const itemsMarcados = useMemo<ItemCompletar[]>(
    () =>
      partidas
        .filter((p) => seleccionados[p.id])
        .map((p) => ({ id: p.id, cantidad: cantidadValida(p) }))
        .filter((it) => it.cantidad > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partidas, seleccionados, cantidades]
  );

  const totalPiezas = useMemo(
    () => itemsMarcados.reduce((s, it) => s + it.cantidad, 0),
    [itemsMarcados]
  );

  const bloqueosStock = useMemo(() => {
    const avisos: string[] = [];
    for (const p of partidas) {
      if (!seleccionados[p.id]) continue;
      const stock = Math.max(0, Math.floor(Number(p.stock) || 0));
      const pedida = Math.floor(Number(cantidades[p.id]) || 0);
      if (stock <= 0) {
        avisos.push(`${p.prenda_nombre} / ${p.talla_nombre}: stock 0 — mete stock o desmárcala`);
      } else if (pedida > stock) {
        avisos.push(
          `${p.prenda_nombre} / ${p.talla_nombre}: pediste ${pedida}, stock ${stock} (máx. ${stock})`
        );
      }
    }
    return avisos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidas, seleccionados, cantidades]);

  const puedeConfirmar = itemsMarcados.length > 0 && bloqueosStock.length === 0;

  const seleccionables = partidas.filter((p) => maxEntregable(p) > 0);
  const todos =
    seleccionables.length > 0 && seleccionables.every((p) => seleccionados[p.id]);

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(920px, 100%)',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.15rem 1.35rem',
            background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
            color: '#fff',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>Completar partidas pendientes</div>
          <div style={{ marginTop: 6, fontSize: '0.9rem', opacity: 0.95 }}>
            {folio || 'Pedido'} {clienteNombre ? `· ${clienteNombre}` : ''}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.9 }}>
            Solo se puede entregar si hay stock. Con stock parcial, el máximo son las piezas
            disponibles. Si falta inventario, usa <strong>+ Stock</strong> en la partida.
          </div>
        </div>

        <div style={{ padding: '1.1rem 1.35rem', overflow: 'auto', flex: 1 }}>
          {cargando ? (
            <p style={{ color: '#64748b' }}>Cargando partidas…</p>
          ) : partidas.length === 0 ? (
            <p style={{ color: '#64748b' }}>No hay partidas con pendientes por entregar.</p>
          ) : (
            <>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: '0.85rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  cursor: seleccionables.length ? 'pointer' : 'not-allowed',
                  opacity: seleccionables.length ? 1 : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={todos}
                  disabled={seleccionables.length === 0}
                  onChange={() => {
                    const next = !todos;
                    const map: Record<string, boolean> = { ...seleccionados };
                    for (const p of partidas) {
                      map[p.id] = next && maxEntregable(p) > 0;
                    }
                    setSeleccionados(map);
                  }}
                  style={{ width: 18, height: 18 }}
                />
                Seleccionar con stock ({seleccionables.length}/{partidas.length})
              </label>

              {bloqueosStock.length > 0 && (
                <div
                  style={{
                    marginBottom: '0.85rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 10,
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  No se puede entregar sin stock suficiente. Mete inventario o baja las piezas a
                  entregar.
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                    {bloqueosStock.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={th} />
                      <th style={th}>Prenda</th>
                      <th style={th}>Talla</th>
                      <th style={{ ...th, textAlign: 'center' }}>Pend.</th>
                      <th style={{ ...th, textAlign: 'center' }}>Stock</th>
                      <th style={{ ...th, textAlign: 'center' }}>Piezas a entregar</th>
                      <th style={th}>Observación</th>
                      <th style={{ ...th, textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidas.map((p) => {
                      const stock = Math.max(0, Math.floor(Number(p.stock) || 0));
                      const max = maxEntregable(p);
                      const sinStock = stock <= 0;
                      const marcado = Boolean(seleccionados[p.id]) && !sinStock;
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderTop: '1px solid #e2e8f0',
                            background: sinStock ? '#fef2f2' : undefined,
                          }}
                        >
                          <td style={{ ...td, width: 44, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={marcado}
                              disabled={sinStock}
                              title={sinStock ? 'Sin stock: usa + Stock primero' : undefined}
                              onChange={() => {
                                if (sinStock) return;
                                setSeleccionados((prev) => ({ ...prev, [p.id]: !prev[p.id] }));
                              }}
                              style={{ width: 18, height: 18 }}
                            />
                          </td>
                          <td style={{ ...td, fontWeight: 700 }}>{p.prenda_nombre}</td>
                          <td style={td}>{p.talla_nombre}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: '#b45309' }}>
                            {p.pendiente}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: 'center',
                              fontWeight: 700,
                              color: sinStock ? '#b91c1c' : '#065f46',
                            }}
                          >
                            {stock}
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <input
                              type="number"
                              min={sinStock ? 0 : 1}
                              max={max || 0}
                              step={1}
                              disabled={!marcado || sinStock}
                              value={cantidades[p.id] ?? String(max || 0)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d]/g, '');
                                setCantidades((prev) => ({ ...prev, [p.id]: raw }));
                              }}
                              onBlur={(e) => {
                                const n = Math.floor(Number(e.target.value));
                                const val =
                                  !Number.isFinite(n) || n <= 0
                                    ? max > 0
                                      ? 1
                                      : 0
                                    : Math.min(n, max);
                                setCantidades((prev) => ({ ...prev, [p.id]: String(val) }));
                              }}
                              style={{
                                width: 72,
                                textAlign: 'center',
                                padding: '0.35rem 0.4rem',
                                borderRadius: 8,
                                border: sinStock ? '2px solid #ef4444' : '1px solid #cbd5e1',
                                fontWeight: 700,
                                background: marcado ? '#fff' : '#f1f5f9',
                                color: marcado ? '#0f172a' : '#94a3b8',
                              }}
                            />
                            {!sinStock && max < p.pendiente && (
                              <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: 2 }}>
                                máx {max}
                              </div>
                            )}
                          </td>
                          <td style={{ ...td, color: '#64748b' }}>{p.especificaciones || '—'}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              title="Meter stock a esta prenda/talla"
                              disabled={guardando || !onAgregarStock}
                              onClick={() => onAgregarStock?.(p)}
                              style={{
                                padding: '0.35rem 0.55rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                background: sinStock
                                  ? 'linear-gradient(135deg, #f97316, #ea580c)'
                                  : undefined,
                                color: sinStock ? '#fff' : undefined,
                                border: sinStock ? 'none' : undefined,
                              }}
                            >
                              + Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: '1rem 1.35rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            alignItems: 'center',
          }}
        >
          {itemsMarcados.length > 0 && (
            <span style={{ marginRight: 'auto', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
              {itemsMarcados.length} partida(s) · {totalPiezas} pieza(s)
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || !puedeConfirmar || partidas.length === 0}
            onClick={() => {
              const frescos: ItemCompletar[] = partidas
                .filter((p) => seleccionados[p.id] && maxEntregable(p) > 0)
                .map((p) => {
                  const max = maxEntregable(p);
                  const raw = cantidades[p.id] ?? String(max);
                  const n = Math.floor(Number(raw));
                  const cantidad =
                    !Number.isFinite(n) || n <= 0 ? 0 : Math.min(n, max);
                  return { id: p.id, cantidad };
                })
                .filter((it) => it.cantidad > 0);

              if (frescos.length === 0) {
                alert('No hay piezas entregables: mete stock o marca partidas con inventario.');
                return;
              }
              for (const it of frescos) {
                const p = partidas.find((x) => x.id === it.id);
                if (!p || maxEntregable(p) < it.cantidad) {
                  alert('Hay partidas sin stock suficiente. Ajusta piezas o mete inventario.');
                  return;
                }
              }
              void onConfirmar(frescos);
            }}
            style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)', border: 'none' }}
          >
            {guardando ? 'Guardando…' : 'Completar marcadas'}
          </button>
        </div>
      </div>
    </div>
  );
}

const th: CSSProperties = {
  padding: '0.7rem 0.85rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#475569',
};

const td: CSSProperties = {
  padding: '0.75rem 0.85rem',
  fontSize: '0.92rem',
  verticalAlign: 'middle',
};

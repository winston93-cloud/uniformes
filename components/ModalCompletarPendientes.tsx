'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

export type PartidaPendienteCompletar = {
  id: string;
  prenda_nombre: string;
  talla_nombre: string;
  pendiente: number;
  cantidad: number;
  especificaciones?: string;
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
};

export default function ModalCompletarPendientes({
  abierto,
  folio,
  clienteNombre,
  partidas,
  cargando = false,
  guardando = false,
  onClose,
  onConfirmar,
}: Props) {
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!abierto) return;
    const initSel: Record<string, boolean> = {};
    const initCant: Record<string, string> = {};
    for (const p of partidas) {
      initSel[p.id] = true;
      initCant[p.id] = String(p.pendiente);
    }
    setSeleccionados(initSel);
    setCantidades(initCant);
  }, [abierto, partidas]);

  const cantidadValida = (p: PartidaPendienteCompletar): number => {
    const n = Math.floor(Number(cantidades[p.id]));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, p.pendiente);
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

  const todos = partidas.length > 0 && partidas.every((p) => seleccionados[p.id]);

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
          width: 'min(720px, 100%)',
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
            Marca las prendas que entregas ahora e indica cuántas piezas de las pendientes se
            entregan. El pedido pasa a COMPLETADO cuando ya no quede ninguna pendiente.
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
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={() => {
                    const next = !todos;
                    const map: Record<string, boolean> = {};
                    for (const p of partidas) map[p.id] = next;
                    setSeleccionados(map);
                  }}
                  style={{ width: 18, height: 18 }}
                />
                Seleccionar todas ({partidas.length})
              </label>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={th} />
                      <th style={th}>Prenda</th>
                      <th style={th}>Talla</th>
                      <th style={{ ...th, textAlign: 'center' }}>Pend.</th>
                      <th style={{ ...th, textAlign: 'center' }}>Piezas a entregar</th>
                      <th style={th}>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidas.map((p) => {
                      const marcado = Boolean(seleccionados[p.id]);
                      return (
                      <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ ...td, width: 44, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() =>
                              setSeleccionados((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                            }
                            style={{ width: 18, height: 18 }}
                          />
                        </td>
                        <td style={{ ...td, fontWeight: 700 }}>{p.prenda_nombre}</td>
                        <td style={td}>{p.talla_nombre}</td>
                        <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: '#b45309' }}>
                          {p.pendiente}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <input
                            type="number"
                            min={1}
                            max={p.pendiente}
                            step={1}
                            disabled={!marcado}
                            value={cantidades[p.id] ?? String(p.pendiente)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setCantidades((prev) => ({ ...prev, [p.id]: raw }));
                            }}
                            onBlur={(e) => {
                              const n = Math.floor(Number(e.target.value));
                              const val =
                                !Number.isFinite(n) || n <= 0
                                  ? 1
                                  : Math.min(n, p.pendiente);
                              setCantidades((prev) => ({ ...prev, [p.id]: String(val) }));
                            }}
                            style={{
                              width: 72,
                              textAlign: 'center',
                              padding: '0.35rem 0.4rem',
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              fontWeight: 700,
                              background: marcado ? '#fff' : '#f1f5f9',
                              color: marcado ? '#0f172a' : '#94a3b8',
                            }}
                          />
                        </td>
                        <td style={{ ...td, color: '#64748b' }}>{p.especificaciones || '—'}</td>
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
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || itemsMarcados.length === 0 || partidas.length === 0}
            onClick={() => void onConfirmar(itemsMarcados)}
            style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)', border: 'none' }}
          >
            {guardando
              ? 'Guardando…'
              : itemsMarcados.length === partidas.length && partidas.length > 0
                ? 'Completar todas'
                : `Completar ${itemsMarcados.length} partida(s)`}
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

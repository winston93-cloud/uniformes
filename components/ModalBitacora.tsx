'use client';

import { useEffect, useMemo, useState } from 'react';

type AuditoriaRow = {
  id: string;
  tabla: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  registro_id: string | null;
  registro_pk?: string | null;
  usuario_id: number | null;
  timestamp: string;
  datos_anteriores?: any;
  datos_nuevos?: any;
};

function fmtFechaHora(fecha: string) {
  try {
    return new Date(fecha).toLocaleString('es-MX');
  } catch {
    return fecha;
  }
}

export default function ModalBitacora({
  abierto,
  onClose,
}: {
  abierto: boolean;
  onClose: () => void;
}) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tabla, setTabla] = useState('');
  const [operacion, setOperacion] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [debug, setDebug] = useState<{ supabaseHost: string | null; serverNowIso: string | null } | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const [seleccion, setSeleccion] = useState<AuditoriaRow | null>(null);
  const [tabDetalle, setTabDetalle] = useState<'ANTES' | 'DESPUES'>('DESPUES');
  const [refreshToken, setRefreshToken] = useState(0);

  const queryKey = useMemo(
    () => `${abierto}|${desde}|${hasta}|${tabla}|${operacion}|${offset}|${limit}|${refreshToken}`,
    [abierto, desde, hasta, tabla, operacion, offset, refreshToken]
  );

  useEffect(() => {
    if (!abierto) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Si el usuario no eligió rango, mantener vacío y dejar que el backend default a últimos 7 días.
        const params = new URLSearchParams();
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
        if (tabla) params.set('tabla', tabla);
        if (operacion) params.set('operacion', operacion);
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        // Evitar cache del navegador / edge
        params.set('_ts', String(Date.now()));
        const res = await fetch(`/api/auditoria?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo cargar la bitácora');
        if (cancel) return;
        setRows(json.rows || []);
        setCount(typeof json.count === 'number' ? json.count : null);
        setDebug(json.debug || null);
        setSeleccion(null);
      } catch (e: any) {
        if (!cancel) setError(e?.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [queryKey]);

  useEffect(() => {
    if (!abierto) return;
    setOffset(0);
  }, [abierto, desde, hasta, tabla, operacion]);

  if (!abierto) return null;

  const puedeAnterior = offset > 0;
  const puedeSiguiente = rows.length === limit && (count === null || offset + limit < count);
  const tieneAntes = Boolean(seleccion?.datos_anteriores);
  const tieneDespues = Boolean(seleccion?.datos_nuevos);

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 11000 }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 'min(1100px, 100vw - 1.5rem)',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Bitácora</h2>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>
              Registro de inserciones, ediciones y eliminaciones por tabla.
            </p>
            {debug?.supabaseHost ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                Conectado a: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{debug.supabaseHost}</span>
                {debug?.serverNowIso ? (
                  <>
                    {' '}
                    · Servidor: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{fmtFechaHora(debug.serverNowIso)}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Desde</label>
              <input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Hasta</label>
              <input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tabla</label>
              <input className="form-input" value={tabla} onChange={(e) => setTabla(e.target.value)} placeholder="Ej: pedidos" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Operación</label>
              <select className="form-select" value={operacion} onChange={(e) => setOperacion(e.target.value)}>
                <option value="">Todas</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {count !== null ? (
                <span>
                  Total: <strong>{count}</strong> · Mostrando {offset + 1}–{offset + rows.length}
                </span>
              ) : (
                <span>Mostrando {rows.length} registros</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={loading}
                onClick={() => setRefreshToken((x) => x + 1)}
                title="Traer los registros más recientes"
              >
                ↻ Refrescar
              </button>
              <button className="btn btn-secondary" type="button" disabled={!puedeAnterior || loading} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
                ← Anterior
              </button>
              <button className="btn btn-secondary" type="button" disabled={!puedeSiguiente || loading} onClick={() => setOffset((o) => o + limit)}>
                Siguiente →
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="table-container" style={{ marginTop: '0.85rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Operación</th>
                  <th>Tabla</th>
                  <th>Registro</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b' }}>
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b' }}>
                      Sin registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setSeleccion(r);
                        setTabDetalle(r.operacion === 'DELETE' ? 'ANTES' : 'DESPUES');
                      }}
                      style={{
                        cursor: 'pointer',
                        background: seleccion?.id === r.id ? '#f1f5f9' : undefined,
                      }}
                      title="Click para ver detalles"
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(r.timestamp)}</td>
                      <td style={{ fontWeight: 800 }}>{String(r.operacion || '').toUpperCase()}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.tabla}</td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {r.registro_id || r.registro_pk || '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{r.usuario_id ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {seleccion && (
            <div
              style={{
                marginTop: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                overflow: 'hidden',
                background: 'white',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 0.9rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                  <strong>Detalle</strong> · {fmtFechaHora(seleccion.timestamp)} ·{' '}
                  <span style={{ fontFamily: 'monospace' }}>{seleccion.tabla}</span> ·{' '}
                  <span style={{ fontWeight: 900 }}>{String(seleccion.operacion).toUpperCase()}</span>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => setSeleccion(null)}>
                  Cerrar detalle
                </button>
              </div>

              <div style={{ padding: '0.75rem 0.9rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!tieneAntes}
                    onClick={() => setTabDetalle('ANTES')}
                    style={tabDetalle === 'ANTES' ? { borderColor: '#334155', fontWeight: 800 } : undefined}
                    title={!tieneAntes ? 'Este registro no tiene "antes"' : undefined}
                  >
                    Antes
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!tieneDespues}
                    onClick={() => setTabDetalle('DESPUES')}
                    style={tabDetalle === 'DESPUES' ? { borderColor: '#334155', fontWeight: 800 } : undefined}
                    title={!tieneDespues ? 'Este registro no tiene "después"' : undefined}
                  >
                    Después
                  </button>
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: '0.85rem',
                    borderRadius: 12,
                    background: '#0b1220',
                    color: '#e2e8f0',
                    fontSize: '0.85rem',
                    overflowX: 'auto',
                    lineHeight: 1.35,
                  }}
                >
                  {JSON.stringify(
                    tabDetalle === 'ANTES' ? seleccion.datos_anteriores ?? null : seleccion.datos_nuevos ?? null,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


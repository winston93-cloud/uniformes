'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SyncResponse =
  | {
      success: true;
      sinceTs: string | null;
      fetched: number;
      mapped: number;
      upserted: number;
      lastAppliedTs: string | null;
      hasMore: boolean;
    }
  | { success: false; error: string };

function fmtFechaHora(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX');
  } catch {
    return iso;
  }
}

export default function ModalActualizarBaseDatos({
  abierto,
  onClose,
}: {
  abierto: boolean;
  onClose: () => void;
}) {
  const [limit, setLimit] = useState(5000);
  const [since, setSince] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<SyncResponse | null>(null);

  const [totalFetched, setTotalFetched] = useState(0);
  const [totalUpserted, setTotalUpserted] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);

  const cancelRef = useRef(false);

  const canStart = useMemo(() => !running, [running]);

  useEffect(() => {
    if (!abierto) return;
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
    };
  }, [abierto]);

  if (!abierto) return null;

  async function runOnce(payload: any): Promise<SyncResponse> {
    const res = await fetch('/api/alumno/sync-mysql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as SyncResponse | null;
    if (json) return json;
    return { success: false, error: `HTTP ${res.status}: Respuesta no-JSON (revisa logs/variables en Vercel)` };
  }

  async function iniciarSync() {
    setRunning(true);
    setError(null);
    setLast(null);
    setTotalFetched(0);
    setTotalUpserted(0);
    setRounds(0);
    const now = new Date().toISOString();
    setStartedAt(now);
    setEndedAt(null);

    try {
      let hasMore = true;
      let guard = 0;
      let sinceTs: string | undefined = since.trim() ? since.trim() : undefined;

      while (hasMore) {
        if (cancelRef.current) break;
        guard += 1;
        if (guard > 50) throw new Error('Se alcanzó el límite de rondas (protección).');

        const payload = { limit, ...(sinceTs ? { since: sinceTs } : {}) };
        const r = await runOnce(payload);
        setLast(r);
        setRounds((x) => x + 1);

        if (!r.success) throw new Error(r.error || 'Error desconocido');

        setTotalFetched((x) => x + (Number(r.fetched) || 0));
        setTotalUpserted((x) => x + (Number(r.upserted) || 0));

        hasMore = Boolean(r.hasMore);
        // A partir de la 1a vuelta, avanzamos la ventana para seguir trayendo el siguiente bloque
        if (r.lastAppliedTs) sinceTs = r.lastAppliedTs;
      }

      setEndedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e?.message || String(e));
      setEndedAt(new Date().toISOString());
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 11000 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: 'min(820px, 100vw - 1.5rem)',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Actualizar base de datos</h2>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>
              Sincroniza alumnos desde phpMyAdmin/MySQL hacia Supabase (upsert por <code>alumno_ref</code>).
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={running}>
            ✕
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Desde (opcional)</label>
              <input
                className="form-input"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                placeholder="Ej: 2026-05-01T00:00:00.000Z"
                disabled={running}
              />
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Si lo dejas vacío, toma el último <code>alumno_actualizacion</code> de Supabase.
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Límite por ronda</label>
              <input
                className="form-input"
                type="number"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(20000, Number(e.target.value) || 1)))}
                disabled={running}
              />
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Recomendado: 5000. Máximo: 20000.
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button" disabled={!canStart} onClick={() => void iniciarSync()}>
              {running ? 'Actualizando…' : 'Actualizar alumnos ahora'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!running}
              onClick={() => {
                cancelRef.current = true;
              }}
              title="Detiene al terminar la ronda actual"
            >
              Detener
            </button>
          </div>

          <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div style={{ padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Progreso</div>
              <div style={{ marginTop: '0.2rem', fontWeight: 800, fontSize: '1.05rem' }}>
                {totalUpserted.toLocaleString('es-MX')} upserts
              </div>
              <div style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                {totalFetched.toLocaleString('es-MX')} filas leídas · {rounds} ronda(s)
              </div>
            </div>
            <div style={{ padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Ejecución</div>
              <div style={{ marginTop: '0.2rem', fontSize: '0.9rem' }}>
                <strong>Inicio:</strong> {fmtFechaHora(startedAt)}
              </div>
              <div style={{ marginTop: '0.15rem', fontSize: '0.9rem' }}>
                <strong>Fin:</strong> {fmtFechaHora(endedAt)}
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '0.9rem' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '0.9rem' }}>
            <div style={{ fontWeight: 800, marginBottom: '0.4rem' }}>Última respuesta</div>
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
              {JSON.stringify(last, null, 2)}
            </pre>
          </div>

          <div style={{ marginTop: '0.9rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
            Nota: esto no borra alumnos; solo actualiza/crea registros en Supabase por <code>alumno_ref</code>.
          </div>
        </div>
      </div>
    </div>
  );
}


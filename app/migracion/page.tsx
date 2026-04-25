'use client';

import { useEffect, useMemo, useState } from 'react';

const TABLAS_34 = [
  'usuario_perfil',
  'roles_uniformes',
  'tallas',
  'categorias_prendas',
  'presentaciones',
  'ubicaciones_almacenamiento',
  'sucursales',
  'ciclos_escolares',
  'usuario',
  'usuarios',
  'usuarios_uniformes',
  'alumnos',
  'externos',
  'prendas',
  'insumos',
  'costos',
  'prenda_talla_insumos',
  'compras_insumos',
  'costo_ubicaciones',
  'insumo_ubicaciones',
  'datos_fiscales_cliente',
  'cotizaciones',
  'detalle_cotizacion',
  'pedidos',
  'detalle_pedidos',
  'movimientos',
  'cortes',
  'detalle_cortes',
  'transferencias',
  'detalle_transferencias',
  'devoluciones',
  'detalle_devoluciones',
  'auditoria',
  'snapshot_insumos_pedido',
] as const;

type EstadoTabla =
  | { status: 'PENDIENTE' }
  | { status: 'MIGRANDO'; progreso?: string }
  | { status: 'OK'; detalle?: string }
  | { status: 'ERROR'; error: string };

export default function MigracionPage() {
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TABLAS_34.map((t) => [t, false]))
  );
  const [estado, setEstado] = useState<Record<string, EstadoTabla>>(() =>
    Object.fromEntries(TABLAS_34.map((t) => [t, { status: 'PENDIENTE' }]))
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [ping, setPing] = useState<{ supabaseHost: string | null; insforgeHost: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const seleccionadas = useMemo(() => TABLAS_34.filter((t) => seleccion[t]), [seleccion]);

  const addLog = (line: string) => setLogs((prev) => [`${new Date().toLocaleString('es-MX')} — ${line}`, ...prev]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/migracion/ping', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Ping falló');
        setPing({ supabaseHost: json.supabaseHost ?? null, insforgeHost: json.insforgeHost ?? null });
      } catch (e: any) {
        addLog(`Ping error: ${e?.message || String(e)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAll = (v: boolean) => {
    setSeleccion(Object.fromEntries(TABLAS_34.map((t) => [t, v])));
  };

  const migrarTabla = async (table: string) => {
    setEstado((s) => ({ ...s, [table]: { status: 'MIGRANDO', progreso: 'Iniciando…' } }));
    addLog(`Migrando ${table}…`);
    try {
      const res = await fetch('/api/migracion/migrate-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ table, batchSize: 1000, chunkSize: 250 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Migración falló en ${table}`);
      setEstado((s) => ({
        ...s,
        [table]: { status: 'OK', detalle: `Insertados: ${json.totalInserted ?? 0}` },
      }));
      addLog(`OK ${table}: insertados ${json.totalInserted ?? 0}`);
    } catch (e: any) {
      setEstado((s) => ({ ...s, [table]: { status: 'ERROR', error: e?.message || String(e) } }));
      addLog(`ERROR ${table}: ${e?.message || String(e)}`);
    }
  };

  const verificarTabla = async (table: string) => {
    addLog(`Verificando ${table}…`);
    try {
      const res = await fetch('/api/migracion/verify-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ table }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Verificación falló en ${table}`);
      const supa = json.supabaseCount;
      const insf = json.insforgeCount;
      const match = json.match;
      addLog(`Verificación ${table}: Supabase=${supa ?? '¿?'} InsForge=${insf ?? '¿?'} Match=${match ?? '¿?'}`);
    } catch (e: any) {
      addLog(`ERROR verificación ${table}: ${e?.message || String(e)}`);
    }
  };

  const migrarSeleccionadas = async () => {
    if (!seleccionadas.length) {
      addLog('Selecciona al menos una tabla.');
      return;
    }
    setBusy(true);
    try {
      for (const t of seleccionadas) {
        // eslint-disable-next-line no-await-in-loop
        await migrarTabla(t);
      }
    } finally {
      setBusy(false);
    }
  };

  const verificarSeleccionadas = async () => {
    if (!seleccionadas.length) {
      addLog('Selecciona al menos una tabla.');
      return;
    }
    setBusy(true);
    try {
      for (const t of seleccionadas) {
        // eslint-disable-next-line no-await-in-loop
        await verificarTabla(t);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main-container" style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', textAlign: 'center', marginBottom: '0.25rem' }}>
          Migración Supabase → InsForge
        </h1>
        <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.95rem' }}>
          {ping ? (
            <>
              Supabase: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{ping.supabaseHost ?? '—'}</span>
              {' · '}
              InsForge: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{ping.insforgeHost ?? '—'}</span>
            </>
          ) : (
            'Validando conexión…'
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => toggleAll(true)}>
          Marcar todo
        </button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => toggleAll(false)}>
          Desmarcar todo
        </button>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={migrarSeleccionadas}>
          Migrar seleccionadas
        </button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={verificarSeleccionadas}>
          Verificar conteos
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          alignItems: 'start',
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Supabase (origen)</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{seleccionadas.length} seleccionadas</div>
          </div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {TABLAS_34.map((t) => (
              <label key={t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!seleccion[t]}
                  disabled={busy}
                  onChange={(e) => setSeleccion((s) => ({ ...s, [t]: e.target.checked }))}
                />
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                  {t}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>InsForge (destino)</h2>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {TABLAS_34.map((t) => {
              const st = estado[t];
              const selected = !!seleccion[t];
              const badge =
                st.status === 'OK'
                  ? { bg: '#16a34a', text: st.detalle || 'OK' }
                  : st.status === 'ERROR'
                    ? { bg: '#dc2626', text: 'ERROR' }
                    : st.status === 'MIGRANDO'
                      ? { bg: '#2563eb', text: 'MIGRANDO' }
                      : { bg: '#64748b', text: 'PENDIENTE' };

              return (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    opacity: selected ? 1 : 0.55,
                  }}
                >
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                    {t}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: 999, background: badge.bg, color: 'white', fontSize: '0.78rem' }}>
                      {badge.text}
                    </span>
                    <button className="btn btn-secondary" type="button" disabled={busy || !selected} onClick={() => migrarTabla(t)}>
                      Migrar
                    </button>
                    <button className="btn btn-secondary" type="button" disabled={busy || !selected} onClick={() => verificarTabla(t)}>
                      Verificar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ margin: '0.85rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            Nota: para que “crear tablas” sea automático, InsForge debe soportar DDL/API de esquema. Aquí migramos datos asumiendo que las tablas existen en InsForge con el mismo nombre.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem', maxWidth: '1100px', margin: '1rem auto 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Logs</h2>
          <button className="btn btn-secondary" type="button" onClick={() => setLogs([])} disabled={busy || logs.length === 0}>
            Limpiar
          </button>
        </div>
        <div
          style={{
            marginTop: '0.75rem',
            background: '#0b1220',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 12,
            padding: '0.75rem',
            maxHeight: 320,
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
            color: '#e2e8f0',
            fontSize: '0.82rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {logs.length ? logs.join('\n') : '—'}
        </div>
      </div>
    </div>
  );
}


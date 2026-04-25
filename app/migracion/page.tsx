'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Orden de importación (Winston → destino) — mismo criterio que usamos en CSV.
 * Si una tabla tiene FKs, respeta este orden de arriba hacia abajo.
 */
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

  // Datos fiscales
  'datos_fiscales_cliente',

  // Cotizaciones
  'cotizaciones',
  'detalle_cotizacion',

  // Pedidos y movimientos
  'pedidos',
  'detalle_pedidos',
  'movimientos',

  // Cortes / transferencias / devoluciones
  'cortes',
  'detalle_cortes',
  'transferencias',
  'detalle_transferencias',
  'devoluciones',
  'detalle_devoluciones',

  // Auditoría / snapshots
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
  const [schemaStatus, setSchemaStatus] = useState<'PENDIENTE' | 'OK' | 'ERROR'>('PENDIENTE');
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [schemaFiles, setSchemaFiles] = useState<string[]>([]);

  const seleccionadas = useMemo(() => TABLAS_34.filter((t) => seleccion[t]), [seleccion]);
  const todasOk = useMemo(() => TABLAS_34.every((t) => estado[t]?.status === 'OK'), [estado]);

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

  const crearEstructurasEnInsForge = async () => {
    setBusy(true);
    addLog('Creando estructuras en InsForge desde migrations de Supabase…');
    try {
      const res = await fetch('/api/migracion/ensure-schema', { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.executed) {
        setSchemaStatus('OK');
        addLog(`OK esquema: ejecutado en InsForge (${String(json.mode || 'ok')})`);
        alert(`✅ Estructuras creadas en InsForge.`);
        return;
      }
      setSchemaStatus('ERROR');
      addLog(`ERROR esquema: ${json?.error || 'No se pudo ejecutar DDL en InsForge'}`);
      alert(
        `❌ No se pudo ejecutar el DDL automáticamente en InsForge.\n\nMotivo: ${json?.error || 'Desconocido'}\n\nPuedo abrir el SQL para copiarlo al SQL Editor.`
      );
      await abrirSqlEsquema();
    } catch (e: any) {
      setSchemaStatus('ERROR');
      addLog(`ERROR esquema: ${e?.message || String(e)}`);
      alert(`❌ Error creando estructuras: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const abrirSqlEsquema = async () => {
    addLog('Generando SQL de esquema (GET /api/migracion/ensure-schema)…');
    const res = await fetch('/api/migracion/ensure-schema', { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo generar el SQL del esquema');
    setSchemaSql(String(json.sql || ''));
    setSchemaFiles(Array.isArray(json.files) ? json.files : []);
    setSchemaModalOpen(true);
    const n = Array.isArray(json.files) ? json.files.length : 0;
    addLog(`SQL listo (${n} archivos de migration).`);
  };

  const migrarTabla = async (table: string) => {
    setEstado((s) => ({ ...s, [table]: { status: 'MIGRANDO', progreso: 'Iniciando…' } }));
    addLog(`Migrando ${table} (DDL + datos)…`);
    try {
      const res = await fetch('/api/migracion/migrate-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ table, batchSize: 1000, chunkSize: 250 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Migración falló en ${table}`);
      setEstado((s) => ({
        ...s,
        [table]: {
          status: 'OK',
          detalle: `Insertados: ${json.totalInserted ?? 0} · DDL: ${String(json.ddlFile || '—')}`,
        },
      }));
      addLog(`OK ${table}: insertados ${json.totalInserted ?? 0} (DDL: ${String(json.ddlFile || '—')})`);
      if (Array.isArray(json?.prerequisiteTables) && json.prerequisiteTables.length) {
        addLog(
          `⚠️ ${table} referencia a: ${json.prerequisiteTables.join(
            ', '
          )} (deben existir en InsForge antes, si el CREATE trae FKs).`
        );
      }
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

  const probarTokenAdminInsForge = async () => {
    setBusy(true);
    try {
      addLog('Probando INSFORGE_ADMIN_TOKEN…');
      const res = await fetch('/api/migracion/insforge-admin-check', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!json) throw new Error('No se pudo leer la respuesta del server (JSON inválido).');
      if (json.error && json.configured === false) {
        addLog(`Admin check: ${json.error}`);
        alert(`❌ ${json.error}`);
        return;
      }
      if (!json.success) {
        addLog(`InsForge admin check: sin endpoints OK`);
        const lines = Array.isArray(json.results)
          ? json.results
              .map((r: any) => `${r.path} → HTTP ${r.status} ok=${r.ok} :: ${String(r.bodySnippet || '').slice(0, 80)}`)
              .join('\n')
          : '—';
        alert(
          `❌ El host de InsForge no respondió como API admin.\n\nBase URL: ${String(json.baseUrl || '—')}\n\nResultados:\n${lines}\n\nSugerencia: ${String(
            json.hint || ''
          )}`
        );
        return;
      }
      addLog(`InsForge admin check: OK (al menos un endpoint respondió 200)`);
      alert('✅ INSFORGE_ADMIN_TOKEN OK (endpoints admin responden).');
    } catch (e: any) {
      addLog(`ERROR admin check: ${e?.message || String(e)}`);
      alert(`❌ No se pudo validar token admin: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const finalizarCutover = async () => {
    if (!todasOk) {
      addLog('Aún faltan tablas por migrar: el corte a InsForge está bloqueado.');
      alert('⚠️ Aún faltan tablas por migrar. Cuando TODAS estén en OK, podrás hacer el corte a InsForge.');
      return;
    }
    const ok = confirm(
      '✅ Todas las tablas están en OK.\n\n¿Deseas iniciar el corte del sistema para operar con InsForge?\n\nNota: esto requiere cambiar variables de entorno y redeploy.'
    );
    if (!ok) return;
    try {
      addLog('Iniciando corte a InsForge (instrucciones)…');
      const res = await fetch('/api/migracion/finalize', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo preparar el corte');
      addLog(`Cutover listo: ${json.message}`);
      alert(json.message);
    } catch (e: any) {
      addLog(`ERROR cutover: ${e?.message || String(e)}`);
      alert(`❌ No se pudo preparar el corte: ${e?.message || String(e)}`);
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
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={crearEstructurasEnInsForge}
          style={{
            background: schemaStatus === 'OK' ? '#16a34a' : schemaStatus === 'ERROR' ? '#dc2626' : '#0ea5e9',
            color: 'white',
            border: 'none',
          }}
        >
          {schemaStatus === 'OK'
            ? '✅ Estructuras OK en InsForge'
            : schemaStatus === 'ERROR'
              ? '❌ Reintentar crear estructuras'
              : '🏗️ Crear estructuras en InsForge'}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={busy}
          onClick={() => {
            setSchemaModalOpen(true);
            if (!schemaSql) {
              abrirSqlEsquema().catch((e: any) => {
                addLog(`ERROR generar SQL: ${e?.message || String(e)}`);
                alert(`❌ No se pudo generar el SQL: ${e?.message || String(e)}`);
              });
            }
          }}
        >
          Ver SQL del esquema
        </button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => toggleAll(true)}>
          Marcar todo
        </button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => toggleAll(false)}>
          Desmarcar todo
        </button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={probarTokenAdminInsForge}>
          Probar token InsForge admin
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
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 999,
                        background: badge.bg,
                        color: 'white',
                        fontSize: '0.78rem',
                        cursor: st.status === 'ERROR' ? 'pointer' : 'default',
                      }}
                      title={st.status === 'ERROR' ? st.error : ''}
                      onClick={() => {
                        if (st.status === 'ERROR') {
                          alert(`❌ Error en ${t}\n\n${st.error}`);
                        }
                      }}
                    >
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
            Nota: al dar <strong>Migrar</strong>, el sistema primero aplica el <strong>CREATE TABLE</strong> (con sus relaciones inline) hacia InsForge vía <code>POST /api/database/migrations</code>, y luego copia los datos desde Supabase. Si la tabla trae llaves a otras tablas, esas tablas referenciadas deben existir ya en InsForge (mígralas antes en el orden de la lista).
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

      <div style={{ maxWidth: '1100px', margin: '1rem auto 0', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={finalizarCutover}
          style={{
            background: todasOk ? '#16a34a' : '#dc2626',
            color: 'white',
            border: 'none',
            padding: '0.9rem 1.2rem',
            borderRadius: 12,
            fontWeight: 800,
            width: 'min(720px, 100%)',
          }}
        >
          {todasOk ? '✅ TODO LISTO — Pasar todo el proyecto a InsForge' : '⛔ Pasar todo el proyecto de Supabase a InsForge'}
        </button>
      </div>

      {schemaModalOpen ? (
        <div
          className="modal-overlay"
          style={{ zIndex: 12000 }}
          onClick={() => setSchemaModalOpen(false)}
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
                <h2 style={{ margin: 0 }}>SQL de esquema para InsForge</h2>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>
                  Copia y pega esto en el <strong>SQL Editor de InsForge</strong> y presiona <strong>Run</strong>.
                </p>
                {schemaFiles.length ? (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                    Incluye {schemaFiles.length} migrations (filtradas sin RLS/Storage/Auditoría triggers).
                  </p>
                ) : null}
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setSchemaModalOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  navigator.clipboard
                    .writeText(schemaSql || '')
                    .then(() => addLog('SQL copiado al portapapeles.'))
                    .catch(() => addLog('No se pudo copiar al portapapeles.'));
                }}
                disabled={!schemaSql}
              >
                Copiar SQL
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setSchemaStatus('OK');
                  addLog('Marcado como OK: esquema aplicado (confirmado manualmente).');
                  setSchemaModalOpen(false);
                }}
              >
                Ya lo ejecuté (marcar OK)
              </button>
            </div>

            <textarea
              value={schemaSql}
              onChange={(e) => setSchemaSql(e.target.value)}
              style={{
                width: '100%',
                minHeight: 420,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '0.82rem',
                background: '#0b1220',
                color: '#e2e8f0',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: 12,
                padding: '0.75rem',
              }}
              placeholder="Cargando SQL…"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}


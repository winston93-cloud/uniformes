'use client';

import { useEffect, useMemo, useState } from 'react';

type Resp = {
  success: boolean;
  totalPublicTables: number;
  foundUniformes: string[];
  missingUniformes: string[];
  extrasPublic: string[];
  error?: string;
};

function Badge({ text, bg }: { text: string; bg: string }) {
  return (
    <span
      style={{
        padding: '0.2rem 0.5rem',
        borderRadius: 999,
        background: bg,
        color: 'white',
        fontSize: '0.78rem',
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

function ListBlock({
  title,
  subtitle,
  items,
  color,
}: {
  title: string;
  subtitle?: string;
  items: string[];
  color: string;
}) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
          {subtitle ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#64748b' }}>{subtitle}</p>
          ) : null}
        </div>
        <Badge text={`${items.length}`} bg={color} />
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
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          color: '#e2e8f0',
          fontSize: '0.82rem',
          whiteSpace: 'pre-wrap',
        }}
      >
        {items.length ? items.map((x) => `- ${x}`).join('\n') : '—'}
      </div>
    </div>
  );
}

export default function InsforgeTablasPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resumen = useMemo(() => {
    if (!data?.success) return null;
    const ok = data.missingUniformes.length === 0;
    return {
      ok,
      total: data.totalPublicTables,
      found: data.foundUniformes.length,
      missing: data.missingUniformes.length,
      extras: data.extrasPublic.length,
    };
  }, [data]);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/migracion/insforge-tables?_ts=${Date.now()}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as Resp | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo cargar el diagnóstico');
      setData(json);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="main-container" style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', textAlign: 'center', marginBottom: '0.25rem' }}>
          Diagnóstico de tablas en InsForge
        </h1>
        <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.95rem' }}>
          {resumen ? (
            <>
              Estado:{' '}
              <Badge text={resumen.ok ? 'OK (sin faltantes)' : 'FALTAN TABLAS'} bg={resumen.ok ? '#16a34a' : '#dc2626'} />{' '}
              · Public: <strong>{resumen.total}</strong> · Uniformes: <strong>{resumen.found}</strong> · Faltan:{' '}
              <strong>{resumen.missing}</strong> · Extras: <strong>{resumen.extras}</strong>
            </>
          ) : (
            'Cargando…'
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button className="btn btn-secondary" type="button" onClick={refresh} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
        <a className="btn btn-secondary" href="/migracion">
          Volver a migración
        </a>
      </div>

      {err ? (
        <div className="card" style={{ padding: '1rem', maxWidth: 1100, margin: '0 auto 1rem' }}>
          <div style={{ color: '#dc2626', fontWeight: 800 }}>Error</div>
          <div style={{ marginTop: '0.35rem', color: '#334155' }}>{err}</div>
        </div>
      ) : null}

      {data?.success ? (
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
          <ListBlock
            title="Encontradas (Uniformes)"
            subtitle="Estas tablas de Uniformes ya existen en InsForge."
            items={data.foundUniformes}
            color="#16a34a"
          />
          <ListBlock
            title="Faltantes (Uniformes)"
            subtitle="Estas tablas deberían existir en InsForge pero aún faltan."
            items={data.missingUniformes}
            color="#dc2626"
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <ListBlock
              title="Extras (no Uniformes)"
              subtitle="Tablas en InsForge (public) que NO pertenecen a las 34 tablas de Uniformes."
              items={data.extrasPublic}
              color="#f59e0b"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}


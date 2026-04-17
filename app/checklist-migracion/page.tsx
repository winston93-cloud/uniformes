'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'uniformes_checklist_migracion_v1';
const NOTES_KEY = 'uniformes_checklist_migracion_notas_v1';

type Item = { id: string; label: string; hint?: string };

type Section = { id: string; title: string; description?: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    id: 'cuentas',
    title: '1. Cuentas nuevas (proveedores)',
    description:
      'Organizaciones limpias para el Plan B: menos riesgo de mezclar egress, DNS o claves viejas con el sistema actual.',
    items: [
      { id: 'c1', label: 'Creada cuenta / organización Supabase nueva (correo dedicado + 2FA).' },
      { id: 'c2', label: 'Creada cuenta Vercel nueva (Team/Hobby según necesidad; 2FA activado).' },
      { id: 'c3', label: 'Creada cuenta InsForge nueva (accesos y facturación documentados).' },
      { id: 'c4', label: 'Guardadas en gestor de secretos: URLs, anon keys, service role (solo donde toque), tokens InsForge.' },
      { id: 'c5', label: 'Definidos responsables y “dueño” de cada panel (quién paga y quién opera).' },
    ],
  },
  {
    id: 'supabase',
    title: '2. Proyecto Supabase nuevo (secundario + alumnos)',
    description:
      'Aquí vive la base de alumnos y, como Plan B, el espejo o parte operativa que quieras mantener en Postgres Supabase.',
    items: [
      { id: 's1', label: 'Proyecto creado en región acordada (latencia y residencia de datos).' },
      { id: 's2', label: 'Plan de facturación y límites revisados (egress, pausa, backups).' },
      { id: 's3', label: 'Esquema de tablas de ALUMNOS (y relacionadas) desplegado en este proyecto.' },
      { id: 's4', label: 'RLS/políticas revisadas para acceso anónimo/autenticado según diseño del front.' },
      { id: 's5', label: 'Migración inicial de datos de alumnos (si aplica): script probado en staging.' },
      { id: 's6', label: 'Backups automáticos y retención comprobados en panel Supabase.' },
      { id: 's7', label: 'URL del API resuelve en DNS desde red de oficina y desde móvil (prueba NXDOMAIN).' },
    ],
  },
  {
    id: 'insforge',
    title: '3. InsForge nuevo (primario)',
    description:
      'Base principal del sistema de uniformes (excepto alumnos en Supabase, según tu reparto). Tecnología nueva: documentar límites y contacto soporte.',
    items: [
      { id: 'i1', label: 'Proyecto / espacio InsForge creado y URL de API documentada.' },
      { id: 'i2', label: 'Modelos o tablas en InsForge alineados con el dominio (pedidos, cotizaciones, stock, etc.).' },
      { id: 'i3', label: 'Claves de API y permisos mínimos configurados (rotación planificada).' },
      { id: 'i4', label: 'Carga o migración inicial de datos no-alumnos probada en entorno de prueba.' },
      { id: 'i5', label: 'Plan de exportación periódica (dump lógico o export InsForge) fuera del proveedor.' },
    ],
  },
  {
    id: 'vercel',
    title: '4. Vercel: dos sistemas (primario y secundario)',
    description:
      'Dos despliegues del front (o mismo repo, dos proyectos): uno apuntando a InsForge y otro a Supabase; variables por proyecto.',
    items: [
      { id: 'v1', label: 'Proyecto Vercel A (primario) creado: build conectado a InsForge (env NEXT_PUBLIC_* / server).' },
      { id: 'v2', label: 'Proyecto Vercel B (secundario/Plan B) creado: build conectado a Supabase nuevo.' },
      { id: 'v3', label: 'Variables de entorno Production copiadas y verificadas (sin claves de otro proyecto viejo).' },
      { id: 'v4', label: 'Dominios o subdominios asignados (ej. app-insforge.* y app-supa.*) y TLS OK.' },
      { id: 'v5', label: 'Preview deployments probados con env de staging si aplica.' },
    ],
  },
  {
    id: 'datos',
    title: '5. Reparto de datos (alumnos vs resto)',
    description:
      'Regla explícita: datos de alumnos en Supabase; resto de negocio en InsForge salvo que decidan duplicar lecturas.',
    items: [
      { id: 'd1', label: 'Documento corto: qué tablas/colecciones son solo Supabase, solo InsForge o ambas (réplica).' },
      { id: 'd2', label: 'Front unificado o dos builds: llamadas API enrutadas según módulo (alumnos → Supabase).' },
      { id: 'd3', label: 'IDs y FKs entre sistemas definidos (UUIDs, sin secuencias cruzadas frágiles).' },
      { id: 'd4', label: 'Prueba extremo a extremo: alta de alumno en Supabase visible en UI.' },
      { id: 'd5', label: 'Prueba extremo a extremo: flujo principal de negocio en InsForge sin tocar alumnos en Supa.' },
    ],
  },
  {
    id: 'bitacora',
    title: '6. Bitácora + job (cron) hacia Supabase',
    description:
      'Log de INSERT/UPDATE/DELETE con marca de aplicado; replay manual o automático para mantener Supabase al día como respaldo.',
    items: [
      { id: 'b1', label: 'Diseño de tabla bitácora (tabla, PK, tipo_op, payload o referencia, created_at, estado).' },
      { id: 'b2', label: 'Escritura en bitácora en la misma operación de negocio (o trigger) en el primario.' },
      { id: 'b3', label: 'Orden total garantizado (secuencia por agregado o global) para replay seguro.' },
      { id: 'b4', label: 'Worker o cron en Vercel / externo: lee pendientes, aplica en Supabase, marca aplicado/error.' },
      { id: 'b5', label: 'Reintentos idempotentes (mismo evento dos veces no duplica datos).' },
      { id: 'b6', label: 'Panel o script manual “reprocesar fallidos” documentado.' },
      { id: 'b7', label: 'Alerta si la cola de pendientes supera umbral (email/Slack).' },
    ],
  },
  {
    id: 'switch',
    title: '7. Conmutador (switch) de URL y comunicación',
    description:
      'Criterio claro para mandar usuarios al primario o al secundario; sin sorpresas de caché o sesión mezclada.',
    items: [
      { id: 'w1', label: 'Definido criterio de switch (flag en Vercel, DNS, proxy o landing de elección).' },
      { id: 'w2', label: 'Runbook de 1 página: “si InsForge cae → activar URL B y avisar a equipo”.' },
      { id: 'w3', label: 'Sesión / localStorage: usuarios saben que pueden cambiar de URL (mensaje o logout limpio).' },
      { id: 'w4', label: 'Prueba de conmutación en horario de bajo tráfico con checklist post-cambio.' },
    ],
  },
  {
    id: 'calidad',
    title: '8. Pruebas, seguridad y go-live',
    items: [
      { id: 'q1', label: 'Smoke test completo en primario (InsForge) antes de cortar tráfico antiguo.' },
      { id: 'q2', label: 'Smoke test en secundario (Supabase) con datos mínimos o réplica.' },
      { id: 'q3', label: 'Revisión de CORS y orígenes permitidos en ambas APIs.' },
      { id: 'q4', label: 'Logs de errores centralizados (Vercel / Supabase / InsForge) enlazados en runbook.' },
      { id: 'q5', label: 'Fecha de go-live acordada y ventana de rollback definida.' },
      { id: 'q6', label: 'Post go-live: 48 h de vigilancia activa (métricas + cola bitácora).' },
    ],
  },
];

function loadState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function loadNotes(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(NOTES_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function ChecklistMigracionPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setChecked(loadState());
    setNotes(loadNotes());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(NOTES_KEY, notes);
  }, [notes, mounted]);

  const allIds = useMemo(() => SECTIONS.flatMap((s) => s.items.map((i) => i.id)), []);
  const total = allIds.length;
  const done = useMemo(() => allIds.filter((id) => checked[id]).length, [allIds, checked]);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const toggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setSectionAll = useCallback((section: Section, value: boolean) => {
    setChecked((prev) => {
      const next = { ...prev };
      for (const it of section.items) {
        next[it.id] = value;
      }
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    if (typeof window !== 'undefined' && !window.confirm('¿Borrar todo el progreso del checklist en este navegador?')) return;
    setChecked({});
  }, []);

  const exportJson = useCallback(() => {
    const payload = { version: 1, checked, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `checklist-migracion-uniformes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [checked, notes]);

  const importJson = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result)) as { checked?: Record<string, boolean>; notes?: string };
          if (data.checked && typeof data.checked === 'object') {
            setChecked(data.checked);
          }
          if (typeof data.notes === 'string') setNotes(data.notes);
          alert('Importación aplicada. Comprueba el progreso.');
        } catch {
          alert('No se pudo leer el JSON.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '1.5rem 1rem 3rem',
        maxWidth: '820px',
        margin: '0 auto',
        fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
        color: '#0f172a',
      }}
    >
      <header style={{ marginBottom: '1.75rem' }}>
        <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: '#64748b' }}>
          <Link href="/dashboard" style={{ color: '#6366f1', textDecoration: 'none' }}>
            ← Volver al panel
          </Link>
        </p>
        <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Checklist: migración Plan B
        </h1>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.95rem', color: '#475569', lineHeight: 1.55 }}>
          Cuentas nuevas (Supabase, Vercel, InsForge), dos sistemas desplegados, alumnos en Supabase y negocio en
          InsForge, bitácora + cron hacia Supabase y conmutador de URL. El progreso se guarda en{' '}
          <strong>este navegador</strong> (localStorage). Usa exportar/importar JSON para respaldo o otra máquina.
        </p>
        <div
          style={{
            marginTop: '1rem',
            height: '10px',
            borderRadius: '999px',
            background: '#e2e8f0',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
          {done} / {total} completados ({pct}%)
        </p>
        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={exportJson}
            style={btnSecondary}
          >
            Exportar JSON
          </button>
          <button type="button" onClick={importJson} style={btnSecondary}>
            Importar JSON
          </button>
          <button type="button" onClick={resetAll} style={btnDanger}>
            Reiniciar checklist
          </button>
        </div>
      </header>

      {!mounted ? (
        <p style={{ color: '#64748b' }}>Cargando checklist…</p>
      ) : (
        SECTIONS.map((section) => (
          <section
            key={section.id}
            style={{
              marginBottom: '1.75rem',
              padding: '1.25rem 1.35rem',
              background: '#fff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{section.title}</h2>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" style={btnMini} onClick={() => setSectionAll(section, true)}>
                  Marcar sección
                </button>
                <button type="button" style={btnMini} onClick={() => setSectionAll(section, false)}>
                  Desmarcar
                </button>
              </div>
            </div>
            {section.description ? (
              <p style={{ margin: '0.5rem 0 0.85rem', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>{section.description}</p>
            ) : null}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {section.items.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    padding: '0.55rem 0',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <input
                    type="checkbox"
                    id={item.id}
                    checked={Boolean(checked[item.id])}
                    onChange={() => toggle(item.id)}
                    style={{ marginTop: '0.2rem', width: '1.05rem', height: '1.05rem', cursor: 'pointer', accentColor: '#6366f1' }}
                  />
                  <label htmlFor={item.id} style={{ cursor: 'pointer', flex: 1, fontSize: '0.92rem', lineHeight: 1.45 }}>
                    {item.label}
                    {item.hint ? (
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>{item.hint}</span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section
        style={{
          padding: '1.25rem 1.35rem',
          background: '#f8fafc',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 700 }}>Notas libres</h2>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
          También se guardan en este navegador. Incluye enlaces internos, fechas o contactos de soporte.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.65rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
          placeholder="Ej. IDs de proyecto Supabase / Vercel / InsForge, URLs definitivas, incidencias…"
        />
      </section>

      <p style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>
        URL de esta página: <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: 6 }}>/checklist-migracion</code>
      </p>
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: '0.45rem 0.85rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  borderColor: '#fecaca',
  color: '#b91c1c',
  background: '#fef2f2',
};

const btnMini: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  background: '#f8fafc',
  color: '#475569',
  cursor: 'pointer',
};

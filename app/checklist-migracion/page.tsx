'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, ListChecks, RotateCcw, Upload } from 'lucide-react';
import styles from './checklist-migracion.module.css';

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
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

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
    setToast('Checklist reiniciado en este dispositivo.');
  }, []);

  const exportJson = useCallback(() => {
    const payload = { version: 1, checked, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `checklist-migracion-uniformes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast('JSON exportado. Revisa la carpeta de descargas.');
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
          setToast('Importación aplicada correctamente.');
        } catch {
          setToast('No se pudo leer el archivo JSON.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div className={styles.page}>
      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      <header className={styles.sticky}>
        <div className={styles.stickyRow}>
          <Link href="/dashboard" className={styles.back} aria-label="Volver al panel principal">
            <ArrowLeft size={20} strokeWidth={2.25} aria-hidden />
            <span>Panel</span>
          </Link>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', verticalAlign: 'middle' }}>
                <ListChecks size={22} strokeWidth={2} className={styles.iconBtn} aria-hidden />
                Migración Plan B
              </span>
            </h1>
            <p className={styles.subtitle}>Checklist guardado en este dispositivo</p>
          </div>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressMeta}>
            <span>Progreso</span>
            <span>
              {done}/{total} ({pct}%)
            </span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${done} de ${total} ítems completados, ${pct} por ciento`}
          >
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnCta} onClick={exportJson}>
            <Download size={18} aria-hidden />
            Exportar
          </button>
          <button type="button" className={styles.btn} onClick={importJson}>
            <Upload size={18} aria-hidden />
            Importar
          </button>
          <button type="button" className={styles.btnDanger} onClick={resetAll}>
            <RotateCcw size={18} aria-hidden />
            Reiniciar
          </button>
        </div>
      </header>

      <p className={styles.intro}>
        Cuentas nuevas (Supabase, Vercel, InsForge), dos despliegues, alumnos en Supabase y negocio en InsForge, bitácora
        + cron y conmutador de URL. Usa <strong>Exportar</strong> para respaldar el progreso en otro archivo o
        dispositivo.
      </p>

      {!mounted ? (
        <p className={styles.loading}>Cargando checklist…</p>
      ) : (
        SECTIONS.map((section) => (
          <section
            key={section.id}
            className={styles.section}
            aria-labelledby={`sec-${section.id}`}
          >
            <div className={styles.sectionHead}>
              <div style={{ minWidth: 0 }}>
                <h2 id={`sec-${section.id}`} className={styles.sectionTitle}>
                  {section.title}
                </h2>
                {section.description ? <p className={styles.sectionDesc}>{section.description}</p> : null}
              </div>
              <div className={styles.sectionActions}>
                <button type="button" className={styles.btnMini} onClick={() => setSectionAll(section, true)}>
                  Marcar todo
                </button>
                <button type="button" className={styles.btnMini} onClick={() => setSectionAll(section, false)}>
                  Desmarcar
                </button>
              </div>
            </div>
            <ul className={styles.list}>
              {section.items.map((item) => (
                <li key={item.id} className={styles.row}>
                  <input
                    type="checkbox"
                    id={item.id}
                    checked={Boolean(checked[item.id])}
                    onChange={() => toggle(item.id)}
                    className={styles.checkbox}
                  />
                  <label htmlFor={item.id} className={styles.label}>
                    {item.label}
                    {item.hint ? (
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 400 }}>
                        {item.hint}
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section className={styles.notesSection} aria-labelledby="notas-titulo">
        <h2 id="notas-titulo" className={styles.notesTitle}>
          Notas libres
        </h2>
        <p className={styles.notesHint}>Se guardan automáticamente en este navegador al escribir.</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={styles.textarea}
          placeholder="IDs de proyecto, URLs, contactos de soporte, incidencias…"
          autoComplete="off"
          spellCheck
        />
      </section>

      <footer className={styles.footer}>
        Ruta:{' '}
        <code className={styles.code}>/checklist-migracion</code>
        <br />
        Áreas táctiles ampliadas · Tipografía Plus Jakarta Sans · Contraste alto
      </footer>
    </div>
  );
}

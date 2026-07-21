'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Transferencia } from '@/lib/types';

export type LineaMovida = {
  tallaId: string;
  tallaNombre: string;
  cantidad: number;
  estadoDetalle: string;
};

export type TransferenciaConMovimiento = {
  transferencia: Transferencia;
  lineas: LineaMovida[];
  totalUnidades: number;
};

export type OpcionBusquedaPrenda = {
  key: string;
  prendaId: string;
  prendaNombre: string;
  prendaCodigo: string;
  tallaId: string | null;
  tallaNombre: string | null;
  label: string;
  sublabel: string;
};

type DetalleIndex = {
  transferenciaId: string;
  prendaId: string;
  prendaNombre: string;
  prendaCodigo: string;
  tallaId: string;
  tallaNombre: string;
  cantidad: number;
  estadoDetalle: string;
};

type Props = {
  transferencias: Transferencia[];
  onResultados: (filtradas: TransferenciaConMovimiento[] | null) => void;
};

function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function enrichNombres(
  prendaIds: string[],
  tallaIds: string[]
): Promise<{
  prendas: Map<string, { nombre: string; codigo: string }>;
  tallas: Map<string, string>;
}> {
  const prendas = new Map<string, { nombre: string; codigo: string }>();
  const tallas = new Map<string, string>();

  if (prendaIds.length) {
    const { data } = await insforgeDb().from('prendas').select('id, nombre, codigo').in('id', prendaIds);
    for (const p of data || []) {
      const r = p as { id: string; nombre?: string; codigo?: string };
      prendas.set(String(r.id), {
        nombre: String(r.nombre ?? ''),
        codigo: String(r.codigo ?? ''),
      });
    }
  }
  if (tallaIds.length) {
    const { data } = await insforgeDb().from('tallas').select('id, nombre').in('id', tallaIds);
    for (const t of data || []) {
      const r = t as { id: string; nombre?: string };
      tallas.set(String(r.id), String(r.nombre ?? ''));
    }
  }
  return { prendas, tallas };
}

export default function BusquedaPrendaTransferencias({
  transferencias,
  onResultados,
}: Props) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [seleccion, setSeleccion] = useState<OpcionBusquedaPrenda | null>(null);
  const [index, setIndex] = useState<DetalleIndex[]>([]);
  const [cargandoIndex, setCargandoIndex] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onResultadosRef = useRef(onResultados);
  onResultadosRef.current = onResultados;

  const transferenciaIds = useMemo(
    () => transferencias.map((t) => t.id).filter(Boolean),
    [transferencias]
  );
  const porId = useMemo(() => {
    const m = new Map<string, Transferencia>();
    for (const t of transferencias) m.set(t.id, t);
    return m;
  }, [transferencias]);

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      if (transferenciaIds.length === 0) {
        setIndex([]);
        return;
      }
      setCargandoIndex(true);
      try {
        const filas: Record<string, unknown>[] = [];
        const chunk = 80;
        for (let i = 0; i < transferenciaIds.length; i += chunk) {
          const ids = transferenciaIds.slice(i, i + chunk);
          const { data, error } = await insforgeDb()
            .from('detalle_transferencias')
            .select('id, transferencia_id, prenda_id, talla_id, cantidad, estado')
            .in('transferencia_id', ids);
          if (error) throw error;
          filas.push(...((data || []) as Record<string, unknown>[]));
        }

        const prendaIds = [
          ...new Set(filas.map((f) => String(f.prenda_id ?? '')).filter(Boolean)),
        ];
        const tallaIds = [
          ...new Set(filas.map((f) => String(f.talla_id ?? '')).filter(Boolean)),
        ];
        const { prendas, tallas } = await enrichNombres(prendaIds, tallaIds);
        if (cancelled) return;

        const mapped: DetalleIndex[] = filas
          .map((f) => {
            const prendaId = String(f.prenda_id ?? '');
            const tallaId = String(f.talla_id ?? '');
            const p = prendas.get(prendaId);
            return {
              transferenciaId: String(f.transferencia_id ?? ''),
              prendaId,
              prendaNombre: p?.nombre || 'Prenda',
              prendaCodigo: p?.codigo || '',
              tallaId,
              tallaNombre: tallas.get(tallaId) || '—',
              cantidad: Math.trunc(Number(f.cantidad ?? 0)),
              estadoDetalle: String(f.estado ?? 'EN_TRANSITO'),
            };
          })
          .filter((d) => d.transferenciaId && d.prendaId && d.cantidad > 0);

        setIndex(mapped);
      } catch (e) {
        console.error('Error indexando prendas de transferencias:', e);
        if (!cancelled) setIndex([]);
      } finally {
        if (!cancelled) setCargandoIndex(false);
      }
    };
    void cargar();
    return () => {
      cancelled = true;
    };
  }, [transferenciaIds.join('|')]);

  const opciones = useMemo((): OpcionBusquedaPrenda[] => {
    const prendaMap = new Map<string, OpcionBusquedaPrenda>();
    const comboMap = new Map<string, OpcionBusquedaPrenda>();

    for (const d of index) {
      if (!prendaMap.has(d.prendaId)) {
        const label = d.prendaCodigo
          ? `${d.prendaNombre} (${d.prendaCodigo})`
          : d.prendaNombre;
        prendaMap.set(d.prendaId, {
          key: `p:${d.prendaId}`,
          prendaId: d.prendaId,
          prendaNombre: d.prendaNombre,
          prendaCodigo: d.prendaCodigo,
          tallaId: null,
          tallaNombre: null,
          label,
          sublabel: 'Todas las tallas transferidas',
        });
      }
      const ck = `${d.prendaId}|${d.tallaId}`;
      if (!comboMap.has(ck)) {
        comboMap.set(ck, {
          key: `pt:${ck}`,
          prendaId: d.prendaId,
          prendaNombre: d.prendaNombre,
          prendaCodigo: d.prendaCodigo,
          tallaId: d.tallaId,
          tallaNombre: d.tallaNombre,
          label: `${d.prendaNombre} · talla ${d.tallaNombre}`,
          sublabel: d.prendaCodigo ? `Código ${d.prendaCodigo}` : 'Prenda + talla',
        });
      }
    }

    const q = norm(texto);
    const all = [...prendaMap.values(), ...comboMap.values()];
    if (!q) {
      return [...prendaMap.values()]
        .sort((a, b) => a.prendaNombre.localeCompare(b.prendaNombre, 'es'))
        .slice(0, 12);
    }

    const scored = all
      .map((o) => {
        const hay = norm(`${o.prendaNombre} ${o.prendaCodigo} ${o.tallaNombre ?? ''} talla ${o.tallaNombre ?? ''}`);
        const match = hay.includes(q) || q.split(/\s+/).every((tok) => tok && hay.includes(tok));
        if (!match) return null;
        // Prefer exact prenda+talla when query mentions a size-like token
        const preferCombo = o.tallaId && /\b\d+\b|[x]?[cgsml]\b|xx?[cgs]/i.test(q);
        const score = (preferCombo ? 0 : o.tallaId ? 2 : 0) + (hay.startsWith(q) ? 0 : 1);
        return { o, score };
      })
      .filter(Boolean) as { o: OpcionBusquedaPrenda; score: number }[];

    scored.sort((a, b) => a.score - b.score || a.o.label.localeCompare(b.o.label, 'es'));
    return scored.slice(0, 15).map((s) => s.o);
  }, [index, texto]);

  const aplicarFiltro = useCallback(
    (sel: OpcionBusquedaPrenda | null) => {
      if (!sel) {
        onResultadosRef.current(null);
        return;
      }
      const porTransf = new Map<string, LineaMovida[]>();
      for (const d of index) {
        if (d.prendaId !== sel.prendaId) continue;
        if (sel.tallaId && d.tallaId !== sel.tallaId) continue;
        const list = porTransf.get(d.transferenciaId) || [];
        list.push({
          tallaId: d.tallaId,
          tallaNombre: d.tallaNombre,
          cantidad: d.cantidad,
          estadoDetalle: d.estadoDetalle,
        });
        porTransf.set(d.transferenciaId, list);
      }

      const resultados: TransferenciaConMovimiento[] = [];
      for (const [tid, lineas] of porTransf) {
        const transferencia = porId.get(tid);
        if (!transferencia) continue;
        const lineasOrden = [...lineas].sort((a, b) =>
          a.tallaNombre.localeCompare(b.tallaNombre, 'es', { numeric: true })
        );
        resultados.push({
          transferencia,
          lineas: lineasOrden,
          totalUnidades: lineasOrden.reduce((s, l) => s + l.cantidad, 0),
        });
      }

      resultados.sort(
        (a, b) =>
          new Date(b.transferencia.fecha_transferencia).getTime() -
          new Date(a.transferencia.fecha_transferencia).getTime()
      );
      onResultadosRef.current(resultados);
    },
    [index, porId]
  );

  useEffect(() => {
    aplicarFiltro(seleccion);
  }, [seleccion, aplicarFiltro]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const elegir = (op: OpcionBusquedaPrenda) => {
    setSeleccion(op);
    setTexto(op.label);
    setAbierto(false);
  };

  const limpiar = () => {
    setSeleccion(null);
    setTexto('');
    setAbierto(false);
    onResultadosRef.current(null);
  };

  return (
    <div
      ref={wrapRef}
      style={{
        marginBottom: '1.25rem',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '1rem 1.15rem',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <label
        htmlFor="busqueda-prenda-transf"
        style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}
      >
        Buscar prenda transferida
      </label>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#64748b' }}>
        Autocompletado con prendas (y talla) que aparecen en transferencias de cualquier estado.
        Ej: <em>CAMISA DE GALA WINSTON talla 4</em>
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            id="busqueda-prenda-transf"
            type="search"
            value={texto}
            autoComplete="off"
            placeholder={
              cargandoIndex
                ? 'Cargando prendas transferidas…'
                : 'Escribe prenda o prenda + talla…'
            }
            disabled={cargandoIndex}
            onChange={(e) => {
              setTexto(e.target.value);
              setSeleccion(null);
              setAbierto(true);
              setIndice(0);
              onResultadosRef.current(null);
            }}
            onFocus={() => setAbierto(true)}
            onKeyDown={(e) => {
              if (!abierto || opciones.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndice((i) => Math.min(i + 1, opciones.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndice((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const op = opciones[indice] ?? opciones[0];
                if (op) elegir(op);
              } else if (e.key === 'Escape') {
                setAbierto(false);
              }
            }}
            style={{
              width: '100%',
              padding: '0.7rem 0.9rem',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: '1rem',
            }}
          />
          {abierto && opciones.length > 0 && (
            <ul
              role="listbox"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 'calc(100% + 4px)',
                margin: 0,
                padding: '0.35rem 0',
                listStyle: 'none',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                maxHeight: 280,
                overflowY: 'auto',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
                zIndex: 20,
              }}
            >
              {opciones.map((op, i) => (
                <li key={op.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === indice}
                    onMouseEnter={() => setIndice(i)}
                    onClick={() => elegir(op)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: i === indice ? '#eff6ff' : 'transparent',
                      padding: '0.65rem 0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{op.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{op.sublabel}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {abierto && texto.trim() && opciones.length === 0 && !cargandoIndex && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 'calc(100% + 4px)',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '0.75rem 0.9rem',
                color: '#64748b',
                fontSize: '0.9rem',
                zIndex: 20,
              }}
            >
              No hay prendas transferidas que coincidan.
            </div>
          )}
        </div>
        {(seleccion || texto) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={limpiar}
            style={{ whiteSpace: 'nowrap' }}
          >
            Limpiar
          </button>
        )}
      </div>
      {seleccion && (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', color: '#334155' }}>
          Mostrando transferencias de <strong>{seleccion.label}</strong>. Abre cada folio con Ver.
        </p>
      )}
    </div>
  );
}

/** Resumen destacado de lo movido de la prenda en esa transferencia. */
export function ResumenMovimientoPrenda({
  lineas,
  totalUnidades,
}: {
  lineas: LineaMovida[];
  totalUnidades: number;
}) {
  return (
    <div
      style={{
        marginTop: '0.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
        alignItems: 'center',
      }}
    >
      {lineas.map((l) => {
        const u = l.cantidad === 1 ? 'pieza' : 'piezas';
        return (
          <span
            key={`${l.tallaId}-${l.cantidad}`}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              fontSize: '0.8rem',
              lineHeight: 1.2,
            }}
          >
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Talla
            </span>
            <strong style={{ color: '#1d4ed8', fontSize: '0.95rem' }}>{l.tallaNombre}</strong>
            <span style={{ color: '#94a3b8' }}>·</span>
            <strong style={{ color: '#047857' }}>{l.cantidad}</strong>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{u}</span>
          </span>
        );
      })}
      {lineas.length > 1 && (
        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
          Total: {totalUnidades} piezas
        </span>
      )}
    </div>
  );
}

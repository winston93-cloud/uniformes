'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { normalizarCamposCostoApi } from '@/lib/costoQueries';
import { compararTallas } from '@/lib/ordenTallas';

export type LineaTransferenciaSeleccionada = {
  costo_id: string;
  prenda_id: string;
  talla_id: string;
  cantidad: number;
  stock_max: number;
  label: string;
};

type FilaCosto = {
  costo_id: string;
  prenda_id: string;
  talla_id: string;
  prenda_nombre: string;
  prenda_codigo: string;
  talla_nombre: string;
  stock: number;
  precio_menudeo: number;
  precio_mayoreo: number;
};

type GrupoPrenda = {
  prenda_id: string;
  nombre: string;
  codigo: string;
  filas: FilaCosto[];
  stockTotal: number;
};

function fmtMxn(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function normalizarBusqueda(s: string) {
  return s.trim().toLowerCase();
}

function normalizarIdKey(id: string) {
  return id.trim().toLowerCase();
}

function GridTallasGrupo({
  g,
  habilitado,
  cantidades,
  setCantidad,
  onLlenarTodo,
  onLimpiar,
}: {
  g: GrupoPrenda;
  habilitado: boolean;
  cantidades: Record<string, number>;
  setCantidad: (costoId: string, val: number, max: number) => void;
  onLlenarTodo: () => void;
  onLimpiar: () => void;
}) {
  const sel = g.filas.reduce((s, f) => s + (cantidades[f.costo_id] ?? 0), 0);

  return (
    <div>
      {habilitado && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }} onClick={onLlenarTodo}>
            ⚡ Todo el stock de esta prenda
          </button>
          {sel > 0 && (
            <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }} onClick={onLimpiar}>
              Limpiar esta prenda
            </button>
          )}
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '0.65rem',
        }}
      >
        {g.filas.map((f) => {
          const qty = cantidades[f.costo_id] ?? 0;
          const activa = qty > 0;
          return (
            <div
              key={f.costo_id}
              style={{
                borderRadius: '12px',
                padding: '0.7rem 0.8rem',
                border: activa ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                background: activa ? '#f5f3ff' : '#fff',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#312e81', marginBottom: '0.35rem' }}>{f.talla_nombre}</div>
              <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.55 }}>
                <div>
                  Stock: <strong style={{ color: f.stock <= 5 ? '#d97706' : '#059669' }}>{f.stock}</strong>
                </div>
                <div>May: {fmtMxn(f.precio_mayoreo)}</div>
                <div>Men: {fmtMxn(f.precio_menudeo)}</div>
              </div>
              {habilitado ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.55rem' }}>
                  <button type="button" aria-label="Menos" onClick={() => setCantidad(f.costo_id, qty - 1, f.stock)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#1e293b' }}>−</button>
                  <input type="number" min={0} max={f.stock} value={qty || ''} placeholder="0" onChange={(e) => setCantidad(f.costo_id, Number(e.target.value) || 0, f.stock)} style={{ width: 48, textAlign: 'center', padding: '0.25rem', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 700, color: '#1e293b' }} />
                  <button type="button" aria-label="Más" onClick={() => setCantidad(f.costo_id, qty + 1, f.stock)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#1e293b' }}>+</button>
                  <button type="button" title="Máximo" onClick={() => setCantidad(f.costo_id, f.stock, f.stock)} style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.45rem', borderRadius: 6, border: 'none', background: '#e0e7ff', color: '#4338ca', cursor: 'pointer' }}>MAX</button>
                </div>
              ) : (
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>Solo lectura</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  origenId: string;
  origenNombre?: string;
  habilitado: boolean;
  onSeleccionChange: (lineas: LineaTransferenciaSeleccionada[]) => void;
  /** Cantidades ya en la transferencia (edición). Se suman al stock visible. */
  cantidadesIniciales?: Record<string, number>;
  /** En edición: arranca mostrando solo las prendas de la transferencia. */
  soloSeleccionadasInicial?: boolean;
};

export default function SelectorPrendasTransferencia({
  origenId,
  origenNombre,
  habilitado,
  onSeleccionChange,
  cantidadesIniciales,
  soloSeleccionadasInicial = false,
}: Props) {
  const [cargando, setCargando] = useState(false);
  const [grupos, setGrupos] = useState<GrupoPrenda[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState('');
  const [sugerenciaIdx, setSugerenciaIdx] = useState(-1);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [soloSeleccionadas, setSoloSeleccionadas] = useState(soloSeleccionadasInicial);
  const [prendaEnfocada, setPrendaEnfocada] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const panelActivoRef = useRef<HTMLDivElement>(null);
  const inicialesRef = useRef<Record<string, number>>(cantidadesIniciales ?? {});
  inicialesRef.current = cantidadesIniciales ?? {};
  const inicialesKey = JSON.stringify(cantidadesIniciales ?? {});

  const cargarInventario = useCallback(async (oid: string) => {
    if (!oid) {
      setGrupos([]);
      return;
    }
    setCargando(true);
    try {
      const { data: costosRaw, error } = await insforgeDb().from('costos').select('*');
      if (error) throw error;

      const reservado = inicialesRef.current;
      const origenKey = oid.trim().toLowerCase();
      const filas: FilaCosto[] = (costosRaw || [])
        .map((r) => normalizarCamposCostoApi(r as Record<string, unknown>))
        .filter((c) => {
          const sid = String(c.sucursal_id ?? '').trim().toLowerCase();
          const id = String(c.id ?? '');
          const stockBase = Number(c.stock ?? 0);
          const extra = Number(reservado[id] ?? 0);
          return sid === origenKey && (stockBase > 0 || extra > 0);
        })
        .map((c) => {
          const id = String(c.id);
          const extra = Number(reservado[id] ?? 0);
          return {
            costo_id: id,
            prenda_id: String(c.prenda_id ?? ''),
            talla_id: String(c.talla_id ?? ''),
            prenda_nombre: '',
            prenda_codigo: '',
            talla_nombre: '',
            stock: Number(c.stock ?? 0) + extra,
            precio_menudeo: Number(c.precio_menudeo ?? 0),
            precio_mayoreo: Number(c.precio_mayoreo ?? 0),
          };
        });

      const prendaIds = [...new Set(filas.map((f) => f.prenda_id).filter(Boolean))];
      const tallaIds = [...new Set(filas.map((f) => f.talla_id).filter(Boolean))];

      const [preRes, taRes] = await Promise.all([
        prendaIds.length
          ? insforgeDb().from('prendas').select('id, nombre, codigo').in('id', prendaIds)
          : Promise.resolve({ data: [] }),
        tallaIds.length
          ? insforgeDb().from('tallas').select('id, nombre, orden').in('id', tallaIds)
          : Promise.resolve({ data: [] }),
      ]);

      const preMap = new Map(
        (preRes.data || []).map((p) => {
          const r = p as { id: string; nombre?: string; codigo?: string | null };
          return [String(r.id).toLowerCase(), r] as const;
        })
      );
      const taMap = new Map(
        (taRes.data || []).map((t) => {
          const r = t as { id: string; nombre?: string; orden?: number };
          return [String(r.id).toLowerCase(), r] as const;
        })
      );

      for (const f of filas) {
        const pre = preMap.get(normalizarIdKey(f.prenda_id));
        const ta = taMap.get(normalizarIdKey(f.talla_id));
        f.prenda_nombre = pre?.nombre ?? 'Prenda';
        f.prenda_codigo = pre?.codigo ?? '';
        f.talla_nombre = ta?.nombre ?? '—';
      }

      const porPrenda = new Map<string, FilaCosto[]>();
      for (const f of filas) {
        const key = normalizarIdKey(f.prenda_id);
        if (!key) continue;
        const arr = porPrenda.get(key) ?? [];
        arr.push(f);
        porPrenda.set(key, arr);
      }

      const agrupados: GrupoPrenda[] = [...porPrenda.entries()].map(([prenda_id, rows]) => {
        const sorted = [...rows].sort((a, b) =>
          compararTallas({ nombre: a.talla_nombre }, { nombre: b.talla_nombre })
        );
        const first = sorted[0];
        return {
          prenda_id,
          nombre: first?.prenda_nombre ?? 'Prenda',
          codigo: first?.prenda_codigo ?? '',
          filas: sorted,
          stockTotal: sorted.reduce((s, r) => s + r.stock, 0),
        };
      });

      agrupados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      setGrupos(agrupados);
      setCantidades({ ...reservado });
    } catch (e) {
      console.error(e);
      setGrupos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setCantidades({});
    setBusqueda('');
    setPrendaEnfocada(null);
    void cargarInventario(origenId);
  }, [origenId, cargarInventario, inicialesKey]);

  const lineasSeleccionadas = useMemo((): LineaTransferenciaSeleccionada[] => {
    const out: LineaTransferenciaSeleccionada[] = [];
    for (const g of grupos) {
      for (const f of g.filas) {
        const qty = cantidades[f.costo_id] ?? 0;
        if (qty > 0) {
          out.push({
            costo_id: f.costo_id,
            prenda_id: f.prenda_id,
            talla_id: f.talla_id,
            cantidad: qty,
            stock_max: f.stock,
            label: `${f.prenda_nombre} — Talla ${f.talla_nombre}`,
          });
        }
      }
    }
    return out;
  }, [grupos, cantidades]);

  useEffect(() => {
    onSeleccionChange(lineasSeleccionadas);
  }, [lineasSeleccionadas, onSeleccionChange]);

  const sugerencias = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    if (!q) return [];
    return grupos
      .filter((g) => g.nombre.toLowerCase().includes(q) || g.codigo.toLowerCase().includes(q))
      .slice(0, 10);
  }, [busqueda, grupos]);

  const gruposVisibles = useMemo(() => {
    let lista = grupos;
    const q = normalizarBusqueda(busqueda);
    if (q) {
      // Con búsqueda se muestran coincidencias del catálogo (para poder agregar).
      lista = lista.filter((g) => g.nombre.toLowerCase().includes(q) || g.codigo.toLowerCase().includes(q));
    } else if (soloSeleccionadas) {
      lista = lista.filter((g) => g.filas.some((f) => (cantidades[f.costo_id] ?? 0) > 0));
    }
    return lista;
  }, [grupos, busqueda, soloSeleccionadas, cantidades]);

  const modoListaExpandida = soloSeleccionadas && !normalizarBusqueda(busqueda) && !prendaEnfocada;

  const grupoActivo = useMemo(
    () => (prendaEnfocada ? grupos.find((g) => g.prenda_id === prendaEnfocada) ?? null : null),
    [grupos, prendaEnfocada]
  );

  useEffect(() => {
    const q = normalizarBusqueda(busqueda);
    if (!q || prendaEnfocada) return;
    const coincidencias = grupos.filter(
      (g) => g.nombre.toLowerCase().includes(q) || g.codigo.toLowerCase().includes(q)
    );
    if (coincidencias.length === 1) {
      setPrendaEnfocada(coincidencias[0].prenda_id);
    }
  }, [busqueda, grupos, prendaEnfocada]);

  const totales = useMemo(() => {
    let piezas = 0;
    const prendas = new Set<string>();
    for (const l of lineasSeleccionadas) {
      piezas += l.cantidad;
      prendas.add(l.prenda_id);
    }
    return { piezas, prendas: prendas.size, lineas: lineasSeleccionadas.length };
  }, [lineasSeleccionadas]);

  const setCantidad = (costoId: string, val: number, max: number) => {
    const n = Math.max(0, Math.min(max, Math.trunc(val)));
    setCantidades((prev) => {
      const next = { ...prev };
      if (n <= 0) delete next[costoId];
      else next[costoId] = n;
      return next;
    });
  };

  const irAPrenda = (prendaId: string) => {
    setPrendaEnfocada(prendaId);
    setDropdownAbierto(false);
    setBusqueda('');
    requestAnimationFrame(() => {
      panelActivoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const elegirSugerencia = (idx: number) => {
    const g = sugerencias[idx];
    if (g) irAPrenda(g.prenda_id);
  };

  const llenarPrendaCompleta = (g: GrupoPrenda) => {
    if (!habilitado) return;
    setCantidades((prev) => {
      const next = { ...prev };
      for (const f of g.filas) next[f.costo_id] = f.stock;
      return next;
    });
  };

  const limpiarPrenda = (g: GrupoPrenda) => {
    setCantidades((prev) => {
      const next = { ...prev };
      for (const f of g.filas) delete next[f.costo_id];
      return next;
    });
  };

  const limpiarTodo = () => setCantidades({});

  const piezasEnPrenda = (g: GrupoPrenda) =>
    g.filas.reduce((s, f) => s + (cantidades[f.costo_id] ?? 0), 0);

  if (!origenId) {
    return <p style={{ color: '#64748b', margin: 0 }}>Elige origen y destino para cargar el inventario.</p>;
  }

  if (cargando) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <p style={{ color: '#64748b', margin: 0 }}>Cargando inventario de {origenNombre ?? 'origen'}…</p>
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <p style={{ color: '#64748b', margin: 0 }}>
        No hay stock disponible en {origenNombre ?? 'esta tienda'} para transferir.
      </p>
    );
  }

  return (
    <div className="transferencia-selector" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.65rem 1rem',
            borderRadius: '14px',
            border: dropdownAbierto ? '2px solid #6366f1' : '2px solid #e2e8f0',
            background: 'linear-gradient(135deg, #fafafa 0%, #fff 100%)',
            boxShadow: dropdownAbierto ? '0 8px 24px rgba(99,102,241,0.15)' : '0 2px 8px rgba(15,23,42,0.06)',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '1.25rem', opacity: 0.7 }} aria-hidden>🔍</span>
          <input
            ref={inputRef}
            type="search"
            disabled={!habilitado}
            placeholder="Buscar por nombre o código…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setSugerenciaIdx(-1);
              setDropdownAbierto(true);
            }}
            onFocus={() => setDropdownAbierto(Boolean(busqueda.trim()))}
            onBlur={() => window.setTimeout(() => setDropdownAbierto(false), 180)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sugerencias.length > 0) {
                e.preventDefault();
                elegirSugerencia(sugerenciaIdx >= 0 ? sugerenciaIdx : 0);
                return;
              }
              if (!dropdownAbierto || sugerencias.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSugerenciaIdx((i) => Math.min(i + 1, sugerencias.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSugerenciaIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Escape') {
                setDropdownAbierto(false);
              }
            }}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', background: 'transparent', color: '#1e293b' }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6366f1', background: '#eef2ff', padding: '0.25rem 0.65rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>
            {grupos.length} prendas
          </span>
        </div>

        {dropdownAbierto && sugerencias.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              margin: 0,
              padding: '0.35rem',
              listStyle: 'none',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 16px 40px rgba(15,23,42,0.12)',
              zIndex: 50,
              maxHeight: '280px',
              overflowY: 'auto',
            }}
          >
            {sugerencias.map((g, i) => (
              <li key={g.prenda_id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegirSugerencia(i)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.65rem 0.85rem',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: i === sugerenciaIdx ? '#eef2ff' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: '#1e293b',
                  }}
                >
                  <span>
                    <strong>{g.nombre}</strong>
                    {g.codigo ? (
                      <code style={{ marginLeft: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>{g.codigo}</code>
                    ) : null}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {g.filas.length} tallas · {g.stockTotal} pzas
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', background: soloSeleccionadas ? '#6366f1' : undefined, color: soloSeleccionadas ? '#fff' : undefined }}
          onClick={() => {
            setSoloSeleccionadas((v) => !v);
            setPrendaEnfocada(null);
          }}
        >
          {soloSeleccionadas ? '✓ Solo en transferencia' : 'Ver solo en transferencia'}
        </button>
        {!soloSeleccionadas && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => {
              setSoloSeleccionadas(true);
              setPrendaEnfocada(null);
              setBusqueda('');
            }}
          >
            Volver a seleccionadas
          </button>
        )}
        {prendaEnfocada && (
          <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }} onClick={() => setPrendaEnfocada(null)}>
            ← Ver lista ({soloSeleccionadas ? 'seleccionadas' : `catálogo ${grupos.length}`})
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#64748b' }}>
          {prendaEnfocada
            ? '1 prenda activa'
            : soloSeleccionadas && !normalizarBusqueda(busqueda)
              ? `${gruposVisibles.length} prenda${gruposVisibles.length === 1 ? '' : 's'} en transferencia`
              : `Mostrando ${gruposVisibles.length} de ${grupos.length}`}
        </span>
      </div>

      {modoListaExpandida && gruposVisibles.length === 0 && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
          No hay prendas en esta transferencia. Busca arriba para agregar.
        </p>
      )}

      {modoListaExpandida && gruposVisibles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Solo las prendas de esta transferencia. Cambia cantidades, quita tallas (a 0) o busca arriba para agregar más.
          </p>
          {gruposVisibles.map((g) => (
            <div
              key={g.prenda_id}
              style={{
                borderRadius: '16px',
                border: '2px solid #c7d2fe',
                background: '#fff',
                padding: '1rem',
                boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
              }}
            >
              <div style={{ marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>{g.nombre}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {g.codigo && (
                      <code style={{ background: '#f1f5f9', padding: '0.1rem 0.45rem', borderRadius: 4, marginRight: '0.5rem' }}>
                        {g.codigo}
                      </code>
                    )}
                    {piezasEnPrenda(g)} piezas seleccionadas
                  </div>
                </div>
                {habilitado && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fecaca' }}
                    onClick={() => limpiarPrenda(g)}
                  >
                    Quitar prenda
                  </button>
                )}
              </div>
              <GridTallasGrupo
                g={g}
                habilitado={habilitado}
                cantidades={cantidades}
                setCantidad={setCantidad}
                onLlenarTodo={() => llenarPrendaCompleta(g)}
                onLimpiar={() => limpiarPrenda(g)}
              />
            </div>
          ))}
        </div>
      )}

      {grupoActivo && !modoListaExpandida && (
        <div
          ref={panelActivoRef}
          style={{
            borderRadius: '16px',
            border: '2px solid #6366f1',
            background: 'linear-gradient(180deg, #eef2ff 0%, #fff 40%)',
            padding: '1.15rem',
            boxShadow: '0 8px 28px rgba(99,102,241,0.18)',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Prenda seleccionada
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '0.25rem' }}>{grupoActivo.nombre}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              {grupoActivo.codigo && (
                <code style={{ background: '#f1f5f9', padding: '0.1rem 0.45rem', borderRadius: 4, marginRight: '0.5rem' }}>{grupoActivo.codigo}</code>
              )}
              {grupoActivo.filas.length} tallas · {grupoActivo.stockTotal} piezas disponibles
            </div>
          </div>
          <GridTallasGrupo
            g={grupoActivo}
            habilitado={habilitado}
            cantidades={cantidades}
            setCantidad={setCantidad}
            onLlenarTodo={() => llenarPrendaCompleta(grupoActivo)}
            onLimpiar={() => limpiarPrenda(grupoActivo)}
          />
        </div>
      )}

      {!grupoActivo && !modoListaExpandida && !normalizarBusqueda(busqueda) && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
          Busca una prenda arriba o elige una del catálogo para ver tallas, stock y precios.
        </p>
      )}

      {!prendaEnfocada && !modoListaExpandida && (
        <div
          ref={listaRef}
          style={{
            maxHeight: 'min(42vh, 420px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            paddingRight: '0.25rem',
          }}
        >
          {gruposVisibles.map((g) => {
            const sel = piezasEnPrenda(g);
            return (
              <div
                key={g.prenda_id}
                role="button"
                tabIndex={0}
                onClick={() => irAPrenda(g.prenda_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    irAPrenda(g.prenda_id);
                  }
                }}
                style={{
                  borderRadius: '12px',
                  border: sel > 0 ? '2px solid #6366f1' : '1px solid #e2e8f0',
                  background: sel > 0 ? '#faf5ff' : '#fff',
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#1e293b',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                }}
              >
                <span style={{ fontSize: '1.2rem', color: '#6366f1' }} aria-hidden>→</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{g.nombre}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                    {g.codigo && (
                      <code style={{ marginRight: '0.5rem', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: 4 }}>{g.codigo}</code>
                    )}
                    {g.filas.length} tallas · {g.stockTotal} pzas
                  </div>
                </div>
                {sel > 0 && (
                  <span style={{ background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '0.78rem', padding: '0.2rem 0.6rem', borderRadius: 999 }}>
                    {sel} sel.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totales.piezas > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            color: '#fff',
            borderRadius: '14px',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 -4px 24px rgba(30,27,75,0.25)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resumen transferencia</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.15rem' }}>{totales.piezas.toLocaleString('es-MX')} piezas</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{totales.prendas} prendas · {totales.lineas} tallas</div>
          </div>
          <div style={{ flex: 1, minWidth: '120px', maxHeight: '64px', overflowY: 'auto', fontSize: '0.78rem', opacity: 0.92 }}>
            {lineasSeleccionadas.slice(0, 8).map((l) => (
              <span key={l.costo_id} style={{ display: 'inline-block', marginRight: '0.5rem', marginBottom: '0.25rem' }}>
                {l.label} ×{l.cantidad}
              </span>
            ))}
            {lineasSeleccionadas.length > 8 && <span>… +{lineasSeleccionadas.length - 8} más</span>}
          </div>
          {habilitado && (
            <button
              type="button"
              onClick={limpiarTodo}
              style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: '2px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

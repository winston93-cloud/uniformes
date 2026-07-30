'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import ModalStockMasivo from '@/components/ModalStockMasivo';
import { useAuth } from '@/contexts/AuthContext';
import { useCostos } from '@/lib/hooks/useCostos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { opcionesInventarioDesdeSesion } from '@/lib/inventarioSucursal';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { agruparCostosPorPrenda } from '@/components/ModalCostosPrenda';
import type { Costo } from '@/lib/types';
import { puedeGestionarCatalogo } from '@/lib/permisos';

export const dynamic = 'force-dynamic';

export default function StockMasivoPage() {
  const { sesion } = useAuth();
  const inventarioOpts = opcionesInventarioDesdeSesion(sesion, 'gestion');
  const puedeEditar = puedeGestionarCatalogo(sesion);
  const { costos, loading, refetch } = useCostos(sesion?.sucursal_id, sesion?.es_matriz, {
    catalogoCompleto: inventarioOpts.catalogoCompleto,
    incluirStockCero: inventarioOpts.incluirStockCero,
  });
  const { prendas } = usePrendas(inventarioOpts);

  const [busqueda, setBusqueda] = useState('');
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [indiceResaltado, setIndiceResaltado] = useState(0);
  const [prendaId, setPrendaId] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const grupos = useMemo(() => agruparCostosPorPrenda(costos), [costos]);

  const prendasConStock = useMemo(() => {
    const ids = new Set(grupos.map((g) => g.prenda_id));
    return prendas
      .filter((p) => p.activo && ids.has(p.id))
      .filter((p) => {
        if (!busqueda.trim()) return true;
        const q = busqueda.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo && p.codigo.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [prendas, grupos, busqueda]);

  const resultadosVisibles = useMemo(() => prendasConStock.slice(0, 40), [prendasConStock]);

  useEffect(() => {
    setIndiceResaltado(0);
  }, [busqueda]);

  useEffect(() => {
    if (indiceResaltado >= resultadosVisibles.length) {
      setIndiceResaltado(Math.max(0, resultadosVisibles.length - 1));
    }
  }, [resultadosVisibles.length, indiceResaltado]);

  useEffect(() => {
    if (!mostrarResultados || !listaRef.current) return;
    const el = listaRef.current.querySelector<HTMLElement>(`[data-idx="${indiceResaltado}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [indiceResaltado, mostrarResultados]);

  const grupoActivo = useMemo(
    () => grupos.find((g) => g.prenda_id === prendaId) ?? null,
    [grupos, prendaId]
  );

  const prendaActiva = useMemo(
    () => prendas.find((p) => p.id === prendaId) ?? null,
    [prendas, prendaId]
  );

  const abrirModalPara = (id: string, _nombre: string) => {
    setPrendaId(id);
    setBusqueda('');
    setMostrarResultados(false);
    setIndiceResaltado(0);
    setMensaje('');
    setModalAbierto(true);
    requestAnimationFrame(() => inputRef.current?.blur());
  };

  const onKeyDownBusqueda = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!puedeEditar) return;
    const ops = resultadosVisibles;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (ops.length === 0) return;
      setMostrarResultados(true);
      setIndiceResaltado((i) => (mostrarResultados ? Math.min(i + 1, ops.length - 1) : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (ops.length === 0) return;
      setMostrarResultados(true);
      setIndiceResaltado((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      if (ops.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setMostrarResultados(true);
      const elegida = ops.length === 1 ? ops[0] : ops[indiceResaltado] ?? ops[0];
      if (elegida) abrirModalPara(elegida.id, elegida.nombre);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setMostrarResultados(false);
    }
  };

  const aplicarAjuste = async (
    ajustes: Array<{ id: string; stockActual: number; delta: number; stockNuevo: number }>
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!puedeEditar) {
      return { ok: false, error: 'No tienes permiso para ajustar stock.' };
    }
    setGuardando(true);
    try {
      const db = insforgeDb();
      for (const a of ajustes) {
        if (a.stockNuevo < 0) {
          throw new Error('El stock no puede quedar negativo.');
        }
        const { error } = await db
          .from('costos')
          .update({ stock: a.stockNuevo, stock_inicial: a.stockNuevo })
          .eq('id', a.id);
        if (error) throw error;

        const abs = Math.abs(a.delta);
        if (abs > 0 && sesion?.es_matriz) {
          try {
            if (a.delta > 0) {
              const r = await db.rpc('sumar_costo_ubicaciones_desde_menor', {
                p_costo_id: a.id,
                p_cantidad: abs,
              });
              if (r?.error) throw r.error;
            } else {
              const r = await db.rpc('descontar_costo_ubicaciones_desde_menor', {
                p_costo_id: a.id,
                p_cantidad: abs,
              });
              if (r?.error) throw r.error;
            }
          } catch {
            /* Sin ubicaciones: basta el stock en costos */
          }
        }
      }
      await refetch();
      setMensaje(
        `Stock actualizado en ${ajustes.length} talla(s) de ${prendaActiva?.nombre || 'la prenda'}.`
      );
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar stock';
      return { ok: false, error: msg };
    } finally {
      setGuardando(false);
    }
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1
          style={{
            fontSize: '2.2rem',
            fontWeight: 700,
            color: 'white',
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            marginBottom: '0.5rem',
          }}
        >
          Stock masivo
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.92)', marginBottom: '1.75rem', maxWidth: 640 }}>
          Busca una prenda, elige tallas y suma o resta la misma cantidad a todas las
          seleccionadas. El cambio se refleja en el stock de tu sucursal.
        </p>

        {!puedeEditar && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 10,
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              color: '#92400e',
            }}
          >
            Tu cuenta no puede editar el catálogo/stock. Usa Uniformes, Mario o Winston.
          </div>
        )}

        <div className="form-container" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">Buscar prenda</label>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              className="form-input"
              value={busqueda}
              disabled={!puedeEditar}
              autoComplete="off"
              role="combobox"
              aria-expanded={mostrarResultados}
              aria-autocomplete="list"
              aria-activedescendant={
                mostrarResultados && resultadosVisibles[indiceResaltado]
                  ? `stock-masivo-opcion-${resultadosVisibles[indiceResaltado].id}`
                  : undefined
              }
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMostrarResultados(true);
                setPrendaId('');
                setIndiceResaltado(0);
              }}
              onFocus={() => {
                setBusqueda('');
                setIndiceResaltado(0);
                setMostrarResultados(true);
              }}
              onBlur={() => setTimeout(() => setMostrarResultados(false), 200)}
              onKeyDown={onKeyDownBusqueda}
              placeholder="🔍 Nombre o código… (↑↓ Enter)"
              style={{ width: '100%' }}
            />
            {mostrarResultados && puedeEditar && (
              <div
                ref={listaRef}
                role="listbox"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  maxHeight: 320,
                  overflowY: 'auto',
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>Cargando…</div>
                ) : resultadosVisibles.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                    No se encontraron prendas con tallas en esta sucursal
                  </div>
                ) : (
                  resultadosVisibles.map((p, idx) => {
                    const g = grupos.find((x) => x.prenda_id === p.id);
                    const nTallas = g?.costos.length ?? 0;
                    const activo = idx === indiceResaltado;
                    return (
                      <div
                        key={p.id}
                        id={`stock-masivo-opcion-${p.id}`}
                        data-idx={idx}
                        role="option"
                        aria-selected={activo}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => abrirModalPara(p.id, p.nombre)}
                        onMouseEnter={() => setIndiceResaltado(idx)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          backgroundColor: activo ? '#e0f2fe' : 'white',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {p.codigo ? `${p.codigo} · ` : ''}
                          {nTallas} talla{nTallas === 1 ? '' : 's'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Usa ↑ ↓ para moverte y Enter para abrir. Si solo hay un resultado, Enter lo selecciona solo.
          </p>
        </div>

        {mensaje && (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: 10,
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              color: '#065f46',
              fontWeight: 600,
            }}
          >
            {mensaje}
          </div>
        )}

        <div className="table-container">
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Prendas con stock en tu sucursal</h3>
          {loading ? (
            <p>Cargando…</p>
          ) : grupos.length === 0 ? (
            <p style={{ color: '#64748b' }}>No hay costos/stock configurados en esta tienda.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {grupos
                .slice()
                .sort((a, b) =>
                  String(a.prenda?.nombre || '').localeCompare(String(b.prenda?.nombre || ''), 'es')
                )
                .map((g) => {
                  const totalStock = g.costos.reduce(
                    (s: number, c: Costo) => s + Math.max(0, Math.round(Number(c.stock ?? 0))),
                    0
                  );
                  return (
                    <button
                      key={g.prenda_id}
                      type="button"
                      disabled={!puedeEditar}
                      onClick={() =>
                        abrirModalPara(g.prenda_id, g.prenda?.nombre || 'Prenda')
                      }
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        background: 'white',
                        cursor: puedeEditar ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        opacity: puedeEditar ? 1 : 0.7,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {g.prenda?.nombre || 'Prenda'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {g.costos.length} talla(s) · stock total {totalStock.toLocaleString('es-MX')}
                        </div>
                      </div>
                      <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '0.9rem' }}>
                        Ajustar →
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {modalAbierto && grupoActivo && (
        <ModalStockMasivo
          abierto={modalAbierto}
          prendaNombre={prendaActiva?.nombre || grupoActivo.prenda?.nombre || 'Prenda'}
          prendaCodigo={prendaActiva?.codigo || grupoActivo.prenda?.codigo}
          costos={grupoActivo.costos}
          guardando={guardando}
          onClose={() => setModalAbierto(false)}
          onAplicar={aplicarAjuste}
        />
      )}
    </LayoutWrapper>
  );
}

'use client';

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import type { CategoriaPrenda } from '@/lib/hooks/useCategorias';

export type ModoFiltroInventario = 'categorias' | 'con_stock' | 'prendas';

export type FiltroInventarioSeleccion = {
  modo: ModoFiltroInventario;
  categoriaIds: string[];
  incluirSinCategoria: boolean;
  prendaIds: string[];
  excluirStockCero: boolean;
  etiquetas: string[];
};

export type PrendaFiltroInventario = {
  id: string;
  nombre: string;
  codigo?: string | null;
  activo?: boolean;
};

interface ModalFiltroInventarioProps {
  categorias: CategoriaPrenda[];
  prendas: PrendaFiltroInventario[];
  loadingCategorias: boolean;
  generando: boolean;
  onClose: () => void;
  onGenerar: (filtro: FiltroInventarioSeleccion) => void;
}

type Pestana = ModoFiltroInventario;

export default function ModalFiltroInventario({
  categorias,
  prendas,
  loadingCategorias,
  generando,
  onClose,
  onGenerar,
}: ModalFiltroInventarioProps) {
  const categoriasOrdenadas = useMemo(
    () =>
      [...categorias].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      ),
    [categorias]
  );

  const prendasOrdenadas = useMemo(
    () =>
      [...prendas]
        .filter((p) => p.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })),
    [prendas]
  );

  const [pestana, setPestana] = useState<Pestana>('categorias');
  const [seleccionCat, setSeleccionCat] = useState<Set<string>>(new Set());
  const [incluirSinCategoria, setIncluirSinCategoria] = useState(false);
  const [seleccionPrenda, setSeleccionPrenda] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    setSeleccionCat(new Set(categoriasOrdenadas.map((c) => c.id)));
    setIncluirSinCategoria(false);
    setBusqueda('');
  }, [categoriasOrdenadas]);

  useEffect(() => {
    setSeleccionPrenda(new Set());
  }, [prendasOrdenadas]);

  useEffect(() => {
    setBusqueda('');
  }, [pestana]);

  const esPorPrenda = pestana === 'prendas';
  const excluirStockCero = pestana === 'con_stock';

  const filtradasCat = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return categoriasOrdenadas;
    return categoriasOrdenadas.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [categoriasOrdenadas, busqueda]);

  const filtradasPrenda = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return prendasOrdenadas;
    return prendasOrdenadas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q))
    );
  }, [prendasOrdenadas, busqueda]);

  const totalSeleccionadas = esPorPrenda
    ? seleccionPrenda.size
    : seleccionCat.size + (incluirSinCategoria ? 1 : 0);

  const toggleCat = (id: string) => {
    setSeleccionCat((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePrenda = (id: string) => {
    setSeleccionPrenda((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seleccionarTodas = () => {
    if (esPorPrenda) {
      setSeleccionPrenda(new Set(prendasOrdenadas.map((p) => p.id)));
    } else {
      setSeleccionCat(new Set(categoriasOrdenadas.map((c) => c.id)));
      setIncluirSinCategoria(true);
    }
  };

  const limpiarTodas = () => {
    if (esPorPrenda) {
      setSeleccionPrenda(new Set());
    } else {
      setSeleccionCat(new Set());
      setIncluirSinCategoria(false);
    }
  };

  const handleGenerar = () => {
    if (totalSeleccionadas === 0) {
      alert(
        esPorPrenda
          ? 'Selecciona al menos una prenda para generar el reporte.'
          : 'Selecciona al menos una categoría para generar el reporte.'
      );
      return;
    }

    if (esPorPrenda) {
      const elegidas = prendasOrdenadas.filter((p) => seleccionPrenda.has(p.id));
      onGenerar({
        modo: 'prendas',
        categoriaIds: [],
        incluirSinCategoria: false,
        prendaIds: elegidas.map((p) => p.id),
        excluirStockCero: false,
        etiquetas: elegidas.map((p) => p.nombre),
      });
      return;
    }

    const etiquetas: string[] = categoriasOrdenadas
      .filter((c) => seleccionCat.has(c.id))
      .map((c) => c.nombre);
    if (incluirSinCategoria) etiquetas.push('Sin categoría');
    if (excluirStockCero) etiquetas.push('Solo stock > 0');

    onGenerar({
      modo: pestana,
      categoriaIds: Array.from(seleccionCat),
      incluirSinCategoria,
      prendaIds: [],
      excluirStockCero,
      etiquetas,
    });
  };

  const filaStyle = (activa: boolean, variante: 'normal' | 'opcional' = 'normal'): CSSProperties => {
    const esOpcional = variante === 'opcional';
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '0.65rem',
      width: '100%',
      minHeight: 44,
      padding: '0.55rem 0.75rem',
      borderRadius: 10,
      border: activa
        ? `2px solid ${esOpcional ? '#8b5cf6' : '#10b981'}`
        : '1px solid rgba(148, 163, 184, 0.45)',
      background: activa
        ? esOpcional
          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(124, 58, 237, 0.05) 100%)'
          : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)'
        : 'rgba(255, 255, 255, 0.95)',
      color: activa ? (esOpcional ? '#5b21b6' : '#065f46') : 'var(--text-primary)',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
      boxShadow: activa ? '0 2px 6px rgba(15, 23, 42, 0.08)' : 'none',
    };
  };

  const tabStyle = (activa: boolean): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    padding: '0.55rem 0.4rem',
    borderRadius: 10,
    border: activa ? '2px solid #0ea5e9' : '1px solid rgba(148, 163, 184, 0.45)',
    background: activa
      ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
      : 'rgba(255,255,255,0.95)',
    color: activa ? '#fff' : '#334155',
    fontWeight: 700,
    fontSize: '0.78rem',
    cursor: 'pointer',
    lineHeight: 1.25,
  });

  const descripcion =
    pestana === 'categorias'
      ? 'Elige categorías. El PDF se agrupa por categoría (A → Z).'
      : pestana === 'con_stock'
        ? 'Igual que categorías, pero no aparecen tallas con stock en 0.'
        : 'Elige una o varias prendas. El PDF se agrupa por categoría de cada una.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-inventario-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="form-container"
        style={{
          width: 'min(480px, 100%)',
          maxHeight: 'min(90vh, 760px)',
          display: 'flex',
          flexDirection: 'column',
          margin: 0,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2 id="modal-inventario-titulo" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>
              📦 Estado de Inventario
            </h2>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              {descripcion}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem', flexShrink: 0 }}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', marginTop: '1.1rem' }}>
          <button type="button" style={tabStyle(pestana === 'categorias')} onClick={() => setPestana('categorias')}>
            Categorías
          </button>
          <button type="button" style={tabStyle(pestana === 'con_stock')} onClick={() => setPestana('con_stock')}>
            Sin stock 0
          </button>
          <button type="button" style={tabStyle(pestana === 'prendas')} onClick={() => setPestana('prendas')}>
            Por prenda
          </button>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <input
            type="search"
            className="form-input"
            placeholder={esPorPrenda ? '🔍 Buscar prenda…' : '🔍 Buscar categoría…'}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => {
              if (esPorPrenda && seleccionPrenda.size > 0) {
                setBusqueda('');
              }
            }}
            disabled={loadingCategorias && !esPorPrenda}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginTop: '0.75rem',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            onClick={seleccionarTodas}
          >
            ✓ Todas
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            onClick={limpiarTodas}
          >
            Limpiar
          </button>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: totalSeleccionadas > 0 ? '#059669' : '#b45309',
            }}
          >
            {totalSeleccionadas} seleccionada{totalSeleccionadas === 1 ? '' : 's'}
          </span>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            marginTop: '1rem',
            minHeight: 120,
            maxHeight: 'min(42vh, 380px)',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            borderRadius: 12,
            background: 'rgba(248, 250, 252, 0.65)',
          }}
        >
          {esPorPrenda ? (
            filtradasPrenda.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
                {busqueda
                  ? 'No hay coincidencias con tu búsqueda.'
                  : 'No hay prendas con inventario en esta cuenta.'}
              </p>
            ) : (
              <div role="listbox" aria-multiselectable="true" aria-label="Prendas">
                {filtradasPrenda.map((p, index) => {
                  const activa = seleccionPrenda.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={activa}
                      onClick={() => togglePrenda(p.id)}
                      style={{
                        ...filaStyle(activa),
                        borderBottom:
                          index < filtradasPrenda.length - 1
                            ? '1px solid rgba(148, 163, 184, 0.22)'
                            : undefined,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          flexShrink: 0,
                          border: activa ? '2px solid #10b981' : '2px solid rgba(148, 163, 184, 0.55)',
                          background: activa ? '#10b981' : '#fff',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {activa ? '✓' : ''}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: '0.9rem',
                          fontWeight: activa ? 600 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.nombre}
                        {p.codigo ? (
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {' '}
                            ({p.codigo})
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : loadingCategorias ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Cargando categorías…</p>
          ) : filtradasCat.length === 0 && !busqueda ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
              No hay categorías en el catálogo. Créalas en Gestión de Categorías de Prendas.
            </p>
          ) : filtradasCat.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>No hay coincidencias con tu búsqueda.</p>
          ) : (
            <div role="listbox" aria-multiselectable="true" aria-label="Categorías de prendas">
              {filtradasCat.map((cat, index) => {
                const activa = seleccionCat.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="option"
                    aria-selected={activa}
                    onClick={() => toggleCat(cat.id)}
                    style={{
                      ...filaStyle(activa),
                      borderBottom:
                        index < filtradasCat.length - 1
                          ? '1px solid rgba(148, 163, 184, 0.22)'
                          : undefined,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        flexShrink: 0,
                        border: activa ? '2px solid #10b981' : '2px solid rgba(148, 163, 184, 0.55)',
                        background: activa ? '#10b981' : '#fff',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {activa ? '✓' : ''}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: '0.9rem',
                        fontWeight: activa ? 600 : 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.nombre}
                      {!cat.activo ? (
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}> (inactiva)</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!esPorPrenda && !busqueda && (
          <div style={{ marginTop: '0.85rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Opcional
              </span>
              <span style={{ height: 1, background: 'rgba(148, 163, 184, 0.35)', flex: 1 }} />
            </div>
            <button
              type="button"
              onClick={() => setIncluirSinCategoria((v) => !v)}
              style={filaStyle(incluirSinCategoria, 'opcional')}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  flexShrink: 0,
                  border: incluirSinCategoria ? '2px solid #8b5cf6' : '2px solid rgba(148, 163, 184, 0.55)',
                  background: incluirSinCategoria ? '#8b5cf6' : '#fff',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {incluirSinCategoria ? '✓' : ''}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: incluirSinCategoria ? 600 : 500 }}>
                Sin categoría
              </span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={generando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleGenerar}
            disabled={generando || (!esPorPrenda && loadingCategorias) || totalSeleccionadas === 0}
          >
            {generando ? '⏳ Generando PDF…' : '📄 Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

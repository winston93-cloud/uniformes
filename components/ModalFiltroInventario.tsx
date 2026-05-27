'use client';

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import type { CategoriaPrenda } from '@/lib/hooks/useCategorias';

export type FiltroInventarioSeleccion = {
  categoriaIds: string[];
  incluirSinCategoria: boolean;
  etiquetas: string[];
};

interface ModalFiltroInventarioProps {
  categorias: CategoriaPrenda[];
  loadingCategorias: boolean;
  generando: boolean;
  onClose: () => void;
  onGenerar: (filtro: FiltroInventarioSeleccion) => void;
}

export default function ModalFiltroInventario({
  categorias,
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

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [incluirSinCategoria, setIncluirSinCategoria] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    setSeleccion(new Set(categoriasOrdenadas.map((c) => c.id)));
    setIncluirSinCategoria(false);
    setBusqueda('');
  }, [categoriasOrdenadas]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return categoriasOrdenadas;
    return categoriasOrdenadas.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [categoriasOrdenadas, busqueda]);

  const totalSeleccionadas =
    seleccion.size + (incluirSinCategoria ? 1 : 0);

  const toggle = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seleccionarTodas = () => {
    setSeleccion(new Set(categoriasOrdenadas.map((c) => c.id)));
    setIncluirSinCategoria(true);
  };

  const limpiarTodas = () => {
    setSeleccion(new Set());
    setIncluirSinCategoria(false);
  };

  const handleGenerar = () => {
    if (totalSeleccionadas === 0) {
      alert('Selecciona al menos una categoría para generar el reporte.');
      return;
    }
    const etiquetas: string[] = categoriasOrdenadas
      .filter((c) => seleccion.has(c.id))
      .map((c) => c.nombre);
    if (incluirSinCategoria) etiquetas.push('Sin categoría');

    onGenerar({
      categoriaIds: Array.from(seleccion),
      incluirSinCategoria,
      etiquetas,
    });
  };

  const filaCategoriaStyle = (activa: boolean, variante: 'normal' | 'opcional' = 'normal'): CSSProperties => {
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
      onClick={onClose}
    >
      <div
        className="form-container"
        style={{
          width: 'min(440px, 100%)',
          maxHeight: 'min(90vh, 720px)',
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
              Elige las categorías del catálogo. El PDF se agrupa por categoría (A → Z).
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

        <div style={{ marginTop: '1.25rem' }}>
          <input
            type="search"
            className="form-input"
            placeholder="🔍 Buscar categoría…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            disabled={loadingCategorias}
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
          <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={seleccionarTodas}>
            ✓ Todas
          </button>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={limpiarTodas}>
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
            maxHeight: 'min(46vh, 400px)',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            borderRadius: 12,
            background: 'rgba(248, 250, 252, 0.65)',
          }}
        >
          {loadingCategorias ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Cargando categorías…</p>
          ) : filtradas.length === 0 && !busqueda ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
              No hay categorías en el catálogo. Créalas en Gestión de Categorías de Prendas.
            </p>
          ) : filtradas.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>No hay coincidencias con tu búsqueda.</p>
          ) : (
            <div
              role="listbox"
              aria-multiselectable="true"
              aria-label="Categorías de prendas"
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              {filtradas.map((cat, index) => {
                const activa = seleccion.has(cat.id);
                const etiqueta = `${cat.nombre}${!cat.activo ? ' (inactiva)' : ''}`;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="option"
                    aria-selected={activa}
                    onClick={() => toggle(cat.id)}
                    style={{
                      ...filaCategoriaStyle(activa),
                      borderBottom:
                        index < filtradas.length - 1 ? '1px solid rgba(148, 163, 184, 0.22)' : undefined,
                    }}
                    title={etiqueta}
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

        {!busqueda && (
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
              style={filaCategoriaStyle(incluirSinCategoria, 'opcional')}
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
              <span style={{ fontSize: '0.9rem', fontWeight: incluirSinCategoria ? 600 : 500 }}>Sin categoría</span>
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
            disabled={generando || loadingCategorias || totalSeleccionadas === 0}
          >
            {generando ? '⏳ Generando PDF…' : '📄 Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

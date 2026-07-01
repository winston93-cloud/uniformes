'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AutocompleteTallaCotizacion, {
  type OpcionTallaCotizacion,
} from '@/components/cotizacion/AutocompleteTallaCotizacion';
import { focusSinScroll, instalarCierrePointerFuera } from '@/lib/cotizacionUi';

type Props = {
  opciones: OpcionTallaCotizacion[];
  value: string;
  selectedId?: string;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChangeTexto: (texto: string) => void;
  onSelect: (opcion: OpcionTallaCotizacion) => void;
  onEnter?: () => void;
  ariaLabel?: string;
  borderColor?: string;
  tituloCatalogo?: string;
};

export default function PickerTallaCotizacion({
  opciones,
  tituloCatalogo = 'Tallas de la prenda',
  ...autocompleteProps
}: Props) {
  const dialogId = useId();
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [indiceCatalogo, setIndiceCatalogo] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const botonCatalogoRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const interaccionRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const opcionesOrdenadas = useMemo(
    () =>
      [...opciones]
        .filter((o) => Boolean(o.nombre?.trim()))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })),
    [opciones]
  );

  const opcionesRef = useRef(opcionesOrdenadas);
  const indiceRef = useRef(indiceCatalogo);
  useEffect(() => {
    opcionesRef.current = opcionesOrdenadas;
  }, [opcionesOrdenadas]);
  useEffect(() => {
    indiceRef.current = indiceCatalogo;
  }, [indiceCatalogo]);

  const cerrarCatalogo = useCallback(() => {
    setCatalogoAbierto(false);
    setIndiceCatalogo(-1);
  }, []);

  const onSelectRef = useRef(autocompleteProps.onSelect);
  const onEnterRef = useRef(autocompleteProps.onEnter);
  const disabledRef = useRef(autocompleteProps.disabled);
  const selectedIdRef = useRef(autocompleteProps.selectedId);
  const valueRef = useRef(autocompleteProps.value);

  useEffect(() => {
    onSelectRef.current = autocompleteProps.onSelect;
    onEnterRef.current = autocompleteProps.onEnter;
    disabledRef.current = autocompleteProps.disabled;
    selectedIdRef.current = autocompleteProps.selectedId;
    valueRef.current = autocompleteProps.value;
  }, [
    autocompleteProps.onSelect,
    autocompleteProps.onEnter,
    autocompleteProps.disabled,
    autocompleteProps.selectedId,
    autocompleteProps.value,
  ]);

  const elegirDesdeCatalogo = useCallback(
    (opcion: OpcionTallaCotizacion, avanzar = true) => {
      onSelectRef.current(opcion);
      cerrarCatalogo();
      if (avanzar) {
        setTimeout(() => onEnterRef.current?.(), 0);
      }
    },
    [cerrarCatalogo]
  );

  const abrirCatalogo = useCallback(() => {
    if (disabledRef.current || opcionesOrdenadas.length === 0) return;
    const idxActual = opcionesOrdenadas.findIndex(
      (o) =>
        o.id === selectedIdRef.current || o.nombre === valueRef.current.trim()
    );
    setIndiceCatalogo(idxActual >= 0 ? idxActual : 0);
    setCatalogoAbierto(true);
  }, [opcionesOrdenadas]);

  useEffect(() => {
    if (!catalogoAbierto) return;
    return instalarCierrePointerFuera(
      [botonCatalogoRef, panelRef],
      cerrarCatalogo,
      interaccionRef
    );
  }, [catalogoAbierto, cerrarCatalogo]);

  useEffect(() => {
    if (!catalogoAbierto) return;
    const panel = panelRef.current;
    if (!panel) return;
    const activo = panel.querySelector<HTMLElement>(
      `[data-catalogo-idx="${indiceCatalogo}"]`
    );
    activo?.scrollIntoView({ block: 'nearest' });
  }, [catalogoAbierto, indiceCatalogo]);

  useEffect(() => {
    if (!catalogoAbierto) return;

    const mover = (delta: number) => {
      const lista = opcionesRef.current;
      if (lista.length === 0) return;
      setIndiceCatalogo((actual) => {
        if (actual < 0) return 0;
        const siguiente = actual + delta;
        if (siguiente < 0) return 0;
        if (siguiente >= lista.length) return lista.length - 1;
        return siguiente;
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        mover(1);
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        mover(-1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const idx = indiceRef.current;
        const pick = opcionesRef.current[idx];
        if (pick) elegirDesdeCatalogo(pick, true);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarCatalogo();
        focusSinScroll(botonCatalogoRef.current);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [catalogoAbierto, cerrarCatalogo, elegirDesdeCatalogo]);

  const catalogoPortal =
    catalogoAbierto && mounted && opcionesOrdenadas.length > 0
      ? createPortal(
          <div
            className="picker-talla-catalogo-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) cerrarCatalogo();
            }}
          >
            <div
              ref={panelRef}
              id={dialogId}
              role="dialog"
              aria-modal="true"
              aria-label={tituloCatalogo}
              className="picker-talla-catalogo-panel"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="picker-talla-catalogo-header">
                <strong>{tituloCatalogo}</strong>
                <span className="picker-talla-catalogo-hint">
                  ↑ ↓ o clic · Enter para elegir · Esc cerrar
                </span>
                <button
                  type="button"
                  className="picker-talla-catalogo-cerrar"
                  onClick={cerrarCatalogo}
                  aria-label="Cerrar catálogo de tallas"
                >
                  ✕
                </button>
              </div>
              <div className="picker-talla-catalogo-grid" role="listbox">
                {opcionesOrdenadas.map((opcion, idx) => {
                  const activa = idx === indiceCatalogo;
                  const seleccionada =
                    opcion.id === autocompleteProps.selectedId ||
                    opcion.nombre === autocompleteProps.value.trim();
                  return (
                    <button
                      key={opcion.id}
                      type="button"
                      role="option"
                      data-catalogo-idx={idx}
                      aria-selected={activa || seleccionada}
                      className={`picker-talla-catalogo-item${activa ? ' is-active' : ''}${
                        seleccionada ? ' is-selected' : ''
                      }`}
                      onMouseEnter={() => setIndiceCatalogo(idx)}
                      onClick={() => elegirDesdeCatalogo(opcion, true)}
                    >
                      {opcion.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="picker-talla-cotizacion">
      <div className="picker-talla-cotizacion-input">
        <AutocompleteTallaCotizacion opciones={opciones} {...autocompleteProps} />
      </div>
      <button
        ref={botonCatalogoRef}
        type="button"
        className="picker-talla-cotizacion-btn"
        title="Ver todas las tallas de la prenda"
        aria-label="Abrir catálogo de tallas"
        aria-haspopup="dialog"
        aria-expanded={catalogoAbierto}
        aria-controls={catalogoAbierto ? dialogId : undefined}
        disabled={autocompleteProps.disabled || opcionesOrdenadas.length === 0}
        onClick={abrirCatalogo}
      >
        ⊞
      </button>
      {catalogoPortal}
    </div>
  );
}

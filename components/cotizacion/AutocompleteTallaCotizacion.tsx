'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  crearOnBlurCerrarDropdown,
  filtrarTallasPorPrefijo,
  focusSinScroll,
  handlersTapSeleccionDropdown,
  instalarCierrePointerFuera,
  mergePropsDropdownPortal,
  posicionDropdownFijo,
  type PosicionDropdown,
} from '@/lib/cotizacionUi';

export type OpcionTallaCotizacion = {
  id: string;
  nombre: string;
};

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
};

export default function AutocompleteTallaCotizacion({
  opciones,
  value,
  selectedId,
  placeholder = 'Ej: M',
  disabled = false,
  inputRef,
  onChangeTexto,
  onSelect,
  onEnter,
  ariaLabel = 'Talla',
  borderColor = '#ddd',
}: Props) {
  const listboxId = useId();
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<PosicionDropdown | null>(null);
  const [indice, setIndice] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const interaccionRef = useRef(false);
  const indiceRef = useRef(-1);
  const abiertoRef = useRef(false);
  const opcionesRef = useRef<OpcionTallaCotizacion[]>([]);
  const valueRef = useRef(value);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onEnterRef = useRef(onEnter);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    indiceRef.current = indice;
  }, [indice]);
  useEffect(() => {
    abiertoRef.current = abierto;
  }, [abierto]);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  const opcionesFiltradas = useMemo(
    () =>
      filtrarTallasPorPrefijo(
        opciones.map((o) => ({ ...o, activo: true })),
        value
      ),
    [opciones, value]
  );

  useEffect(() => {
    opcionesRef.current = opcionesFiltradas;
  }, [opcionesFiltradas]);

  const obtenerInput = useCallback(
    () => inputRef?.current || anchorRef.current,
    [inputRef]
  );

  const reposicionar = useCallback(() => {
    const anchor = obtenerInput();
    if (!anchor) return;
    setPos(posicionDropdownFijo(anchor, 120, 220));
  }, [obtenerInput]);

  const hayTextoBusqueda = value.trim().length > 0;
  const mostrarDropdown = abierto && hayTextoBusqueda && opcionesFiltradas.length > 0;

  useEffect(() => {
    if (!mostrarDropdown) return;
    reposicionar();
    return instalarCierrePointerFuera(
      [anchorRef, portalRef, ...(inputRef ? [inputRef] : [])],
      () => setAbierto(false),
      interaccionRef
    );
  }, [mostrarDropdown, inputRef, value, reposicionar]);

  useEffect(() => {
    if (indice < 0 || !portalRef.current) return;
    const items = portalRef.current.querySelectorAll('.cotizacion-autocomplete-dropdown-item');
    (items[indice] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [indice, opcionesFiltradas]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setIndice(-1);
  }, []);

  const abrir = useCallback(
    (resetIndice = true) => {
      if (disabled || !valueRef.current.trim()) return;
      reposicionar();
      setAbierto(true);
      if (resetIndice) setIndice(-1);
    },
    [disabled, reposicionar]
  );

  const elegir = useCallback(
    (opcion: OpcionTallaCotizacion, avanzarFocus = false) => {
      onSelectRef.current(opcion);
      cerrar();
      if (avanzarFocus) {
        setTimeout(() => onEnterRef.current?.(), 0);
      }
    },
    [cerrar]
  );

  const resolverOpcionTeclado = useCallback((): OpcionTallaCotizacion | null => {
    const lista = opcionesRef.current;
    if (lista.length === 0) return null;
    const idx = indiceRef.current;
    if (idx >= 0 && idx < lista.length) return lista[idx];
    if (lista.length === 1) return lista[0];
    const q = valueRef.current.trim().toUpperCase();
    if (!q) return null;
    return (
      lista.find((o) => o.nombre.toUpperCase() === q) ??
      lista.find((o) => o.nombre.toUpperCase().startsWith(q)) ??
      null
    );
  }, []);

  const moverIndice = useCallback((delta: 1 | -1) => {
    const lista = opcionesRef.current;
    if (lista.length === 0) {
      setIndice(-1);
      return;
    }
    setIndice((actual) => {
      if (actual < 0) return delta > 0 ? 0 : lista.length - 1;
      const siguiente = actual + delta;
      if (siguiente < 0) return 0;
      if (siguiente >= lista.length) return lista.length - 1;
      return siguiente;
    });
  }, []);

  useEffect(() => {
    const el = obtenerInput();
    if (!el || disabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') {
        return;
      }

      if (e.key === 'ArrowDown') {
        if (!valueRef.current.trim()) return;
        e.preventDefault();
        e.stopPropagation();
        if (!abiertoRef.current) abrir(false);
        moverIndice(1);
        return;
      }

      if (e.key === 'ArrowUp') {
        if (!valueRef.current.trim()) return;
        e.preventDefault();
        e.stopPropagation();
        if (!abiertoRef.current) abrir(false);
        moverIndice(-1);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const pick = abiertoRef.current ? resolverOpcionTeclado() : null;
        if (pick) {
          elegir(pick, true);
          return;
        }
        if (selectedIdRef.current || valueRef.current.trim()) {
          onEnterRef.current?.();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cerrar();
      }
    };

    el.addEventListener('keydown', onKeyDown, true);
    return () => el.removeEventListener('keydown', onKeyDown, true);
  }, [abrir, cerrar, disabled, elegir, moverIndice, obtenerInput, resolverOpcionTeclado]);

  const inputEl = (
    <input
      ref={(node) => {
        anchorRef.current = node;
        if (inputRef && 'current' in inputRef) {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      }}
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-expanded={mostrarDropdown}
      aria-autocomplete="list"
      aria-controls={mostrarDropdown ? listboxId : undefined}
      aria-activedescendant={
        mostrarDropdown && indice >= 0 ? `${listboxId}-opcion-${indice}` : undefined
      }
      autoComplete="off"
      onFocus={() => {
        if (value.trim()) abrir(false);
      }}
      onChange={(e) => {
        const texto = e.target.value;
        onChangeTexto(texto);
        if (texto.trim()) {
          abrir(true);
        } else {
          cerrar();
        }
      }}
      onBlur={crearOnBlurCerrarDropdown(interaccionRef, cerrar)}
      style={{
        padding: '0.5rem',
        borderRadius: '4px',
        border: `1px solid ${borderColor}`,
        fontSize: '0.9rem',
        width: '100%',
      }}
    />
  );

  const dropdown =
    mostrarDropdown && pos && mounted
      ? createPortal(
          <div
            ref={portalRef}
            id={listboxId}
            role="listbox"
            className="cotizacion-autocomplete-dropdown"
            {...mergePropsDropdownPortal(interaccionRef, {
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
              zIndex: 10020,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            })}
          >
            {opcionesFiltradas.map((opcion, idx) => {
              const activa = idx === indice;
              return (
                <div
                  key={opcion.id}
                  id={`${listboxId}-opcion-${idx}`}
                  role="option"
                  aria-selected={activa}
                  className={`cotizacion-autocomplete-dropdown-item${activa ? ' is-active' : ''}`}
                  onMouseEnter={() => setIndice(idx)}
                  {...handlersTapSeleccionDropdown(() => {
                    elegir(opcion);
                    focusSinScroll(anchorRef.current);
                  }, interaccionRef)}
                >
                  {opcion.nombre}
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {inputEl}
      {dropdown}
    </>
  );
}

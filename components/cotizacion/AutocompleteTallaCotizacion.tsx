'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<PosicionDropdown | null>(null);
  const [indice, setIndice] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const interaccionRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const opcionesFiltradas = useMemo(
    () =>
      filtrarTallasPorPrefijo(
        opciones.map((o) => ({ ...o, activo: true })),
        value
      ),
    [opciones, value]
  );

  const reposicionar = () => {
    const anchor = inputRef?.current || anchorRef.current;
    if (!anchor) return;
    setPos(posicionDropdownFijo(anchor, 120, 220));
  };

  useEffect(() => {
    if (!abierto) return;
    reposicionar();
    return instalarCierrePointerFuera(
      [anchorRef, portalRef, ...(inputRef ? [inputRef] : [])],
      () => setAbierto(false),
      interaccionRef
    );
  }, [abierto, inputRef, value]);

  const abrir = (resetIndice = true) => {
    if (disabled) return;
    reposicionar();
    setAbierto(true);
    if (resetIndice) setIndice(-1);
  };

  const elegir = (opcion: OpcionTallaCotizacion, avanzarFocus = false) => {
    onSelect(opcion);
    setAbierto(false);
    setIndice(-1);
    if (avanzarFocus) {
      setTimeout(() => onEnter?.(), 0);
    }
  };

  const opcionParaTeclado = (): OpcionTallaCotizacion | null => {
    if (opcionesFiltradas.length === 0) return null;
    if (indice >= 0 && indice < opcionesFiltradas.length) {
      return opcionesFiltradas[indice];
    }
    if (opcionesFiltradas.length === 1) {
      return opcionesFiltradas[0];
    }
    const q = value.trim().toUpperCase();
    if (!q) return null;
    return (
      opcionesFiltradas.find((o) => o.nombre.toUpperCase() === q) ??
      opcionesFiltradas.find((o) => o.nombre.toUpperCase().startsWith(q)) ??
      null
    );
  };

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
      aria-expanded={abierto}
      aria-autocomplete="list"
      autoComplete="off"
      onFocus={() => abrir()}
      onChange={(e) => {
        onChangeTexto(e.target.value);
        abrir(true);
      }}
      onBlur={crearOnBlurCerrarDropdown(interaccionRef, () => setAbierto(false))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!abierto) abrir(false);
          setIndice((i) => {
            if (opcionesFiltradas.length === 0) return -1;
            if (i < 0) return 0;
            return Math.min(i + 1, opcionesFiltradas.length - 1);
          });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!abierto) abrir(false);
          setIndice((i) => {
            if (opcionesFiltradas.length === 0) return -1;
            if (i <= 0) return 0;
            return i - 1;
          });
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const pick = abierto ? opcionParaTeclado() : null;
          if (pick) {
            elegir(pick, true);
            return;
          }
          if (selectedId || value.trim()) {
            onEnter?.();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setAbierto(false);
          setIndice(-1);
        }
      }}
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
    abierto && pos && opcionesFiltradas.length > 0 && mounted
      ? createPortal(
          <div
            ref={portalRef}
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
            {opcionesFiltradas.map((opcion, idx) => (
              <div
                key={opcion.id}
                className={`cotizacion-autocomplete-dropdown-item${
                  idx === indice || opcion.id === selectedId ? ' selected' : ''
                }`}
                onMouseEnter={() => setIndice(idx)}
                {...handlersTapSeleccionDropdown(() => {
                  elegir(opcion);
                  focusSinScroll(anchorRef.current);
                }, interaccionRef)}
                style={{
                  padding: '0.55rem 0.75rem',
                  cursor: 'pointer',
                  background:
                    idx === indice || opcion.id === selectedId ? '#eef2ff' : 'white',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '0.9rem',
                }}
              >
                {opcion.nombre}
              </div>
            ))}
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

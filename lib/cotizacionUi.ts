import type { CSSProperties, FocusEventHandler, HTMLAttributes } from 'react';
import { esIOS } from '@/lib/abrirPdfNavegador';

export { esIOS };

/** iPhone, iPad, Android y tablets: pantalla táctil (no solo iOS). */
export function esDispositivoTactil(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches)
  );
}

export type RefInteraccionDropdown = { current: boolean };

export type InteraccionDropdownGate = RefInteraccionDropdown | (() => boolean);

function interaccionDropdownActiva(gate?: InteraccionDropdownGate): boolean {
  if (!gate) return false;
  return typeof gate === 'function' ? gate() : gate.current;
}

const estilosDropdownPortalScroll: CSSProperties = {
  touchAction: 'pan-y',
  overscrollBehavior: 'contain',
  WebkitOverflowScrolling: 'touch',
};

/** Marca interacción táctil con el portal para no cerrar el dropdown en el blur del input. */
export function propsDropdownPortalScroll(
  refInteraccion: RefInteraccionDropdown
): HTMLAttributes<HTMLDivElement> {
  const liberar = () => {
    window.setTimeout(() => {
      refInteraccion.current = false;
    }, 500);
  };

  return {
    onTouchStart: () => {
      refInteraccion.current = true;
    },
    onTouchMove: () => {
      refInteraccion.current = true;
    },
    onPointerDown: (e) => {
      refInteraccion.current = true;
      if (e.pointerType === 'mouse') {
        e.preventDefault();
      }
    },
    onTouchEnd: liberar,
    onTouchCancel: liberar,
    style: estilosDropdownPortalScroll,
  };
}

/** Combina handlers de scroll móvil con estilos inline del portal. */
export function mergePropsDropdownPortal(
  refInteraccion: RefInteraccionDropdown,
  style: CSSProperties
): HTMLAttributes<HTMLDivElement> {
  const portal = propsDropdownPortalScroll(refInteraccion);
  return {
    ...portal,
    style: { ...portal.style, ...style },
  };
}

/** Cierra el dropdown al perder foco el input, salvo si el usuario está tocando el listado. */
export function crearOnBlurCerrarDropdown(
  refInteraccion: RefInteraccionDropdown,
  onClose: () => void,
  delayMs = 220
): FocusEventHandler<HTMLElement> {
  return () => {
    window.setTimeout(() => {
      if (refInteraccion.current) return;
      onClose();
    }, delayMs);
  };
}

/** Cierra al tocar fuera de los contenedores (input + portal). Mejor que touchstart suelto en móvil. */
export function instalarCierrePointerFuera(
  refs: Array<{ current: HTMLElement | null }>,
  onClose: () => void,
  refInteraccion?: InteraccionDropdownGate
): () => void {
  const handler = (event: PointerEvent) => {
    if (interaccionDropdownActiva(refInteraccion)) return;
    const target = event.target as Node;
    if (refs.some((r) => r.current?.contains(target))) return;
    onClose();
  };
  document.addEventListener('pointerdown', handler, true);
  return () => document.removeEventListener('pointerdown', handler, true);
}

/** Evita que el click fantasma móvil cierre el modal tras elegir un ítem del portal. */
export function crearSupresorClickFantasma() {
  const ref = { current: false };
  return {
    activar(ms = 600) {
      ref.current = true;
      window.setTimeout(() => {
        ref.current = false;
      }, ms);
    },
    activo() {
      return ref.current;
    },
  };
}

/** Selección en ítem de dropdown: distingue tap de scroll (iOS/Android/tablet). */
export function handlersTapSeleccionDropdown(
  onSelect: () => void,
  refInteraccion?: RefInteraccionDropdown
): Pick<
  HTMLAttributes<HTMLDivElement>,
  'onTouchStart' | 'onTouchMove' | 'onTouchEnd' | 'onPointerDown' | 'onClick'
> {
  let startX = 0;
  let startY = 0;
  let moved = false;
  let seleccionadoPorTouch = false;
  const UMBRAL = 10;

  const marcarInteraccion = () => {
    if (refInteraccion) refInteraccion.current = true;
  };

  return {
    onTouchStart: (e) => {
      marcarInteraccion();
      seleccionadoPorTouch = false;
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
    },
    onTouchMove: (e) => {
      marcarInteraccion();
      const t = e.touches[0];
      if (!t) return;
      if (
        Math.abs(t.clientX - startX) > UMBRAL ||
        Math.abs(t.clientY - startY) > UMBRAL
      ) {
        moved = true;
      }
    },
    onTouchEnd: (e) => {
      marcarInteraccion();
      if (moved) return;
      e.preventDefault();
      seleccionadoPorTouch = true;
      onSelect();
      window.setTimeout(() => {
        seleccionadoPorTouch = false;
      }, 400);
    },
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') {
        e.preventDefault();
      }
    },
    onClick: (e) => {
      if (seleccionadoPorTouch || esDispositivoTactil()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onSelect();
    },
  };
}

/** Lleva el contenedor scrollable al inicio (p. ej. al abrir modal en móvil). */
export function scrollContenedorAlInicio(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.scrollTop = 0;
  requestAnimationFrame(() => {
    el.scrollTop = 0;
  });
}

/** Al tocar el input con prenda ya elegida, selecciona todo el texto para borrar/reemplazar fácil. */
export function seleccionarTodoTextoInput(el: HTMLInputElement | null | undefined): void {
  if (!el || !el.value) return;
  const seleccionar = () => {
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      el.select();
    }
  };
  seleccionar();
  requestAnimationFrame(seleccionar);
}

/** Evita saltos de scroll al enfocar inputs dentro del modal (Safari iOS). */
export function focusSinScroll(el: HTMLElement | null | undefined): void {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/** Auto-focus solo en escritorio; en móvil el teclado suele desplazar el modal. */
export function focusCotizacionSiEscritorio(el: HTMLElement | null | undefined): void {
  if (esDispositivoTactil()) return;
  setTimeout(() => focusSinScroll(el), 80);
}

/** Incluye el ítem guardado aunque esté inactivo (edición de cotizaciones). */
export function catalogoSatParaSelect<T extends { id: string }>(
  activos: T[],
  todos: T[],
  seleccionId: string
): T[] {
  if (!seleccionId || activos.some((x) => x.id === seleccionId)) return activos;
  const extra = todos.find((x) => x.id === seleccionId);
  return extra ? [extra, ...activos] : activos;
}

export type PosicionDropdown = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  arriba: boolean;
};

function metricasViewportVisible() {
  if (typeof window === 'undefined') {
    return { top: 0, left: 0, width: 320, height: 640, bottom: 640 };
  }
  const vv = window.visualViewport;
  if (vv) {
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
      bottom: vv.offsetTop + vv.height,
    };
  }
  return {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    bottom: window.innerHeight,
  };
}

/**
 * Posición para portales `position: fixed` (sin sumar scroll de la página).
 * Usa visualViewport para quedar visible sobre el teclado móvil.
 */
export function posicionDropdownFijo(
  anchor: HTMLElement,
  minWidth = 320,
  maxHeightPref = 280,
  opciones?: { forzarArribaEnTactil?: boolean }
): PosicionDropdown {
  const rect = anchor.getBoundingClientRect();
  const margen = 8;
  const gap = 6;
  const vp = metricasViewportVisible();
  const minUsable = 100;

  const anchoMax = Math.min(480, vp.width - margen * 2);
  const width = Math.min(anchoMax, Math.max(rect.width, minWidth, vp.width * 0.55));

  let left = rect.left;
  const vpRight = vp.left + vp.width;
  if (left + width > vpRight - margen) {
    left = Math.max(vp.left + margen, vpRight - width - margen);
  }
  if (left < vp.left + margen) {
    left = vp.left + margen;
  }

  const spaceBelow = vp.bottom - rect.bottom - margen;
  const spaceAbove = rect.top - vp.top - margen;
  const forzarArriba = Boolean(opciones?.forzarArribaEnTactil && esDispositivoTactil());
  const preferBelow = forzarArriba
    ? false
    : spaceBelow >= minUsable || spaceBelow >= spaceAbove;

  let top: number;
  let maxHeight: number;
  let arriba: boolean;

  if (preferBelow) {
    arriba = false;
    top = rect.bottom + gap;
    maxHeight = Math.min(maxHeightPref, Math.max(minUsable, spaceBelow - gap));
  } else {
    arriba = true;
    maxHeight = Math.min(maxHeightPref, Math.max(minUsable, spaceAbove - gap));
    top = Math.max(vp.top + margen, rect.top - maxHeight - gap);
  }

  return { top, left, width, maxHeight, arriba };
}

/** Dropdown de prenda en cotización: en móvil abre arriba del input (teclado + input + lista visibles). */
export function posicionDropdownPrendaCotizacion(anchor: HTMLElement): PosicionDropdown {
  return posicionDropdownFijo(anchor, 320, 200, { forzarArribaEnTactil: true });
}

/** Reposiciona dropdowns cuando el teclado móvil cambia el viewport visible. */
export function suscribirReposicionDropdownViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.addEventListener('resize', handler, { passive: true });
  const vv = window.visualViewport;
  vv?.addEventListener('resize', handler, { passive: true });
  vv?.addEventListener('scroll', handler, { passive: true });
  return () => {
    window.removeEventListener('resize', handler);
    vv?.removeEventListener('resize', handler);
    vv?.removeEventListener('scroll', handler);
  };
}

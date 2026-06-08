import type { CSSProperties, FocusEventHandler, HTMLAttributes } from 'react';
import { esIOS } from '@/lib/abrirPdfNavegador';

export { esIOS };

export type RefInteraccionDropdown = { current: boolean };

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
    }, 350);
  };

  return {
    onTouchStart: () => {
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
  refInteraccion?: RefInteraccionDropdown
): () => void {
  const handler = (event: PointerEvent) => {
    if (refInteraccion?.current) return;
    const target = event.target as Node;
    if (refs.some((r) => r.current?.contains(target))) return;
    onClose();
  };
  document.addEventListener('pointerdown', handler, true);
  return () => document.removeEventListener('pointerdown', handler, true);
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

/** Auto-focus solo en escritorio; en iPhone el teclado + scroll del modal suele trabar la UI. */
export function focusCotizacionSiEscritorio(el: HTMLElement | null | undefined): void {
  if (esIOS()) return;
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
  maxHeightPref = 280
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
  const preferBelow = spaceBelow >= minUsable || spaceBelow >= spaceAbove;

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

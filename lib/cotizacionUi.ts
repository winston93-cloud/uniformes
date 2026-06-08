import { esIOS } from '@/lib/abrirPdfNavegador';

export { esIOS };

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

export type PosicionDropdown = { top: number; left: number; width: number };

/**
 * Posición para portales `position: fixed` (sin sumar scroll de la página).
 * Ajusta ancho mínimo y mantiene el menú dentro del viewport.
 */
export function posicionDropdownFijo(
  anchor: HTMLElement,
  minWidth = 320,
  maxHeight = 280
): PosicionDropdown {
  const rect = anchor.getBoundingClientRect();
  const margen = 8;
  const anchoMax = Math.min(480, window.innerWidth - margen * 2);
  const width = Math.min(anchoMax, Math.max(rect.width, minWidth, window.innerWidth * 0.55));

  let left = rect.left;
  if (left + width > window.innerWidth - margen) {
    left = Math.max(margen, window.innerWidth - width - margen);
  }

  let top = rect.bottom + 6;
  if (top + maxHeight > window.innerHeight - margen) {
    top = Math.max(margen, rect.top - maxHeight - 6);
  }

  return { top, left, width };
}

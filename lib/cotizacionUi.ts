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

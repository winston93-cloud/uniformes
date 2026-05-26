import type { jsPDF } from 'jspdf';

/** iPhone, iPod y iPad (incl. iPadOS con UA de Mac). */
export function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

/**
 * Abre ventana en el mismo gesto del usuario (antes de awaits).
 * Safari iOS bloquea popups si window.open va después de generar el PDF.
 */
export function abrirVentanaPdfPlaceholder(): Window | null {
  if (!esIOS()) return null;
  try {
    return window.open('about:blank', '_blank');
  } catch {
    return null;
  }
}

export function cerrarVentanaPdf(ventana: Window | null | undefined): void {
  try {
    ventana?.close();
  } catch {
    // ignore
  }
}

/** Muestra un jsPDF en pestaña nueva o descarga (fallback iOS / popup bloqueado). */
export function mostrarPdfJsPDF(
  doc: jsPDF,
  nombreArchivo: string,
  ventanaPrevia?: Window | null
): void {
  const nombre = nombreArchivo.endsWith('.pdf') ? nombreArchivo : `${nombreArchivo}.pdf`;
  const url = String(doc.output('bloburl'));

  if (esIOS()) {
    if (ventanaPrevia && !ventanaPrevia.closed) {
      ventanaPrevia.location.href = url;
      return;
    }
    doc.save(nombre);
    return;
  }

  const ventana =
    ventanaPrevia && !ventanaPrevia.closed
      ? ventanaPrevia
      : window.open(url, '_blank', 'noopener,noreferrer');

  if (ventana) {
    ventana.location.href = url;
  } else {
    doc.save(nombre);
  }
}

/** Solo dígitos → entero (inputs con separador de miles, sin decimales). */
export function parseEnteroFormateado(value: string): number {
  const d = value.replace(/\D/g, '');
  if (!d) return 0;
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Enteros con comas de miles al escribir (ej. 1000 → 1,000). */
export function formatearEnteroMilesAlEscribir(value: string): string {
  const d = value.replace(/\D/g, '');
  if (!d) return '';
  const n = parseInt(d, 10);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US');
}

/** Quita comas de miles y parsea float (punto decimal). */
export function parseNumeroFormateado(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '.') return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Miles con coma, decimales con punto (máx. 2), tolera "." final al escribir.
 */
export function formatearNumeroMilesDecimalesAlEscribir(value: string): string {
  const normalized = value.replace(/,/g, '');
  if (normalized === '') return '';
  if (normalized === '.') return '.';

  const firstDot = normalized.indexOf('.');
  const intRaw = firstDot === -1 ? normalized : normalized.slice(0, firstDot);
  const decRaw = firstDot === -1 ? '' : normalized.slice(firstDot + 1).replace(/\./g, '');

  const intDigits = intRaw.replace(/\D/g, '');
  const decDigits = decRaw.replace(/\D/g, '').slice(0, 2);

  if (intDigits === '' && decDigits === '') {
    if (firstDot !== -1 && firstDot === normalized.length - 1) return '.';
    return '';
  }

  const intNum = intDigits === '' ? 0 : parseInt(intDigits, 10);
  const intFmt = intNum.toLocaleString('en-US');

  if (firstDot !== -1) {
    if (decDigits.length > 0) return `${intFmt}.${decDigits}`;
    return `${intFmt}.`;
  }
  return intFmt;
}

/** Valor numérico desde BD → texto con miles y hasta 2 decimales. */
export function formatoNumeroDesdeDb(n: number, maxDecimals = 2): string {
  if (!Number.isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

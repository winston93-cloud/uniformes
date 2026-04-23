import type { Cotizacion } from '@/lib/types';

/**
 * Fecha de entrega más próxima → más lejana.
 * Sin `fecha_entrega` al final; empate por folio descendente (más reciente primero).
 */
export function compareCotizacionesPorFechaEntrega(a: Cotizacion, b: Cotizacion): number {
  const fa = a.fecha_entrega || '9999-12-31';
  const fb = b.fecha_entrega || '9999-12-31';
  const d = fa.localeCompare(fb);
  if (d !== 0) return d;
  return (b.folio || '').localeCompare(a.folio || '');
}

/**
 * Fecha de cotización más nueva → más vieja.
 * Empate por folio descendente (más reciente primero).
 */
export function compareCotizacionesPorFechaCotizacionDesc(a: Cotizacion, b: Cotizacion): number {
  const fa = String(a.fecha_cotizacion || '');
  const fb = String(b.fecha_cotizacion || '');
  // ISO date compares lexicographically; if timestamp, this still works for ISO strings.
  const d = fb.localeCompare(fa);
  if (d !== 0) return d;
  return (b.folio || '').localeCompare(a.folio || '');
}

/** Ítems de producción (partidas) ordenados por fecha de entrega de la cotización padre. */
export function compareItemsProduccionPorFechaEntrega<
  T extends { fecha_entrega?: string | null; folio: string; detalle_id: string },
>(a: T, b: T): number {
  const fa = a.fecha_entrega || '9999-12-31';
  const fb = b.fecha_entrega || '9999-12-31';
  const d = fa.localeCompare(fb);
  if (d !== 0) return d;
  return `${a.folio}\u0000${a.detalle_id}`.localeCompare(`${b.folio}\u0000${b.detalle_id}`);
}

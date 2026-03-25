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

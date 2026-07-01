/** Borrador: se guarda al capturar partidas; pasa a emitido al generar la cotización. */
export const ESTADO_COTIZACION_BORRADOR = 'en_proceso' as const;

/** Orden estricto del flujo operativo (no incluye borrador). */
export const ORDEN_ESTADO_COTIZACION = [
  'emitido',
  'aprobado',
  'trabajando',
  'terminado',
] as const;

export type EstadoCotizacionFlujo = (typeof ORDEN_ESTADO_COTIZACION)[number];
export type EstadoCotizacion = typeof ESTADO_COTIZACION_BORRADOR | EstadoCotizacionFlujo;

const ETIQUETA_ESTADO: Record<EstadoCotizacion, string> = {
  en_proceso: 'En proceso',
  emitido: 'Emitido',
  aprobado: 'Aprobado',
  trabajando: 'Trabajando',
  terminado: 'Terminado',
};

export function esEstadoBorradorCotizacion(estado: string): boolean {
  return estado === ESTADO_COTIZACION_BORRADOR;
}

export function etiquetaEstadoCotizacion(estado: string): string {
  return ETIQUETA_ESTADO[estado as EstadoCotizacion] ?? estado;
}

/** Opciones que puede elegir el usuario según el estado actual (mismo o posteriores). */
export function obtenerEstadosCotizacionPermitidosDesde(estadoActual: string) {
  if (esEstadoBorradorCotizacion(estadoActual)) {
    return [{ value: ESTADO_COTIZACION_BORRADOR, label: ETIQUETA_ESTADO.en_proceso }];
  }
  const idx = ORDEN_ESTADO_COTIZACION.indexOf(estadoActual as EstadoCotizacionFlujo);
  if (idx === -1) {
    return ORDEN_ESTADO_COTIZACION.map((value) => ({
      value,
      label: ETIQUETA_ESTADO[value],
    }));
  }
  return ORDEN_ESTADO_COTIZACION.slice(idx).map((value) => ({
    value,
    label: ETIQUETA_ESTADO[value],
  }));
}

export function transicionEstadoCotizacionValida(desde: string, hacia: string): boolean {
  if (esEstadoBorradorCotizacion(desde)) {
    return hacia === ESTADO_COTIZACION_BORRADOR;
  }
  const i = ORDEN_ESTADO_COTIZACION.indexOf(desde as EstadoCotizacionFlujo);
  const j = ORDEN_ESTADO_COTIZACION.indexOf(hacia as EstadoCotizacionFlujo);
  if (i === -1 || j === -1) return false;
  return j >= i;
}

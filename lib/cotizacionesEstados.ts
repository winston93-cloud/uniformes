/** Orden estricto del flujo: no se permite retroceder (solo avanzar o mantener). */
export const ORDEN_ESTADO_COTIZACION = [
  'emitido',
  'aprobado',
  'trabajando',
  'terminado',
] as const;

export type EstadoCotizacionFlujo = (typeof ORDEN_ESTADO_COTIZACION)[number];

const ETIQUETA_ESTADO: Record<EstadoCotizacionFlujo, string> = {
  emitido: 'Emitido',
  aprobado: 'Aprobado',
  trabajando: 'Trabajando',
  terminado: 'Terminado',
};

/** Opciones que puede elegir el usuario según el estado actual (mismo o posteriores). */
export function obtenerEstadosCotizacionPermitidosDesde(estadoActual: string) {
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

export function transicionEstadoCotizacionValida(
  desde: string,
  hacia: string
): boolean {
  const i = ORDEN_ESTADO_COTIZACION.indexOf(desde as EstadoCotizacionFlujo);
  const j = ORDEN_ESTADO_COTIZACION.indexOf(hacia as EstadoCotizacionFlujo);
  if (i === -1 || j === -1) return false;
  return j >= i;
}

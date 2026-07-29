/** Lógica de línea de venta Prendas / Tenis / Remate tenis — solo cuenta Winston (SUC-WIN). */

export const WINSTON_SUCURSAL_CODIGO = 'SUC-WIN';

/** Código de Matriz Madero — cuenta Uniformes / Mario. */
export const UNIFORMES_SUCURSAL_CODIGO = 'MAT-MAD';

/** ID de la prenda TENIS en catálogo (ZAPATERIA). */
export const TENIS_PRENDA_ID = '5a291f2f-fc07-41a3-bff8-082df51d13ff';

/** ID de REMATE TENIS (misma lógica de línea que tenis; folio rt…). */
export const REMATE_TENIS_PRENDA_ID = '06e12e49-6819-463a-9302-1c1d09495de3';

export type LineaVentaWinston = 'prendas' | 'tenis' | 'remate_tenis';
export type FiltroLineaVenta = 'todos' | LineaVentaWinston;

export type SesionLineaVenta = {
  sucursal_codigo?: string | null;
  es_matriz?: boolean | null;
};

export function esCuentaWinston(sesion?: SesionLineaVenta | null): boolean {
  return sesion?.sucursal_codigo === WINSTON_SUCURSAL_CODIGO && sesion?.es_matriz !== true;
}

/** Selector de reportes: cuenta = tienda (Winston ↔ SUC-WIN, Uniformes ↔ MAT-MAD). */
export type CuentaReporte = 'winston' | 'uniformes';

export const OPCIONES_CUENTA_REPORTE: { value: CuentaReporte; label: string }[] = [
  { value: 'winston', label: 'Winston' },
  { value: 'uniformes', label: 'Uniformes' },
];

export function cuentaReporteDesdeSesion(sesion?: SesionLineaVenta | null): CuentaReporte {
  return esCuentaWinston(sesion) ? 'winston' : 'uniformes';
}

export function codigoSucursalDeCuenta(cuenta: CuentaReporte): string {
  return cuenta === 'winston' ? WINSTON_SUCURSAL_CODIGO : UNIFORMES_SUCURSAL_CODIGO;
}

export function esCuentaWinstonSeleccionada(cuenta: CuentaReporte): boolean {
  return cuenta === 'winston';
}

export type SucursalCuentaReporte = {
  id: string;
  nombre: string;
  codigo?: string | null;
  es_matriz?: boolean | null;
};

/** Resuelve la sucursal de BD para la cuenta elegida. */
export function resolverSucursalCuentaReporte(
  sucursales: SucursalCuentaReporte[],
  cuenta: CuentaReporte
): SucursalCuentaReporte | null {
  const codigo = codigoSucursalDeCuenta(cuenta);
  const porCodigo = sucursales.find(
    (s) => String(s.codigo ?? '').trim().toUpperCase() === codigo
  );
  if (porCodigo) return porCodigo;
  if (cuenta === 'winston') {
    return (
      sucursales.find((s) => /winston/i.test(String(s.nombre ?? '')) && !s.es_matriz) ?? null
    );
  }
  return sucursales.find((s) => s.es_matriz) ?? null;
}

export function etiquetaCuentaReporte(cuenta: CuentaReporte, sucursalNombre?: string | null): string {
  if (cuenta === 'winston') {
    return sucursalNombre?.trim() ? `Winston (${sucursalNombre})` : 'Winston';
  }
  return sucursalNombre?.trim() ? `Uniformes (${sucursalNombre})` : 'Uniformes';
}

export function esPrendaTenis(
  prendaId: string | null | undefined,
  prendaNombre?: string | null
): boolean {
  if (prendaId && prendaId === TENIS_PRENDA_ID) return true;
  const n = (prendaNombre ?? '').trim().toLowerCase();
  return n === 'tenis' || n === 'tennis';
}

export function esPrendaRemateTenis(
  prendaId: string | null | undefined,
  prendaNombre?: string | null
): boolean {
  if (prendaId && prendaId === REMATE_TENIS_PRENDA_ID) return true;
  const n = (prendaNombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return n === 'remate tenis' || n === 'rematetenis';
}

/** Tenis o remate tenis (cualquier línea de zapatería especial Winston). */
export function esPrendaLineaZapateria(
  prendaId: string | null | undefined,
  prendaNombre?: string | null
): boolean {
  return esPrendaTenis(prendaId, prendaNombre) || esPrendaRemateTenis(prendaId, prendaNombre);
}

export function inferirLineaVentaDesdeFolio(folio?: string | null): LineaVentaWinston | null {
  const f = (folio ?? '').trim().toLowerCase();
  if (f.startsWith('rt')) return 'remate_tenis';
  if (f.startsWith('wt')) return 'tenis';
  if (f.startsWith('wu')) return 'prendas';
  return null;
}

export function leerLineaVentaPedido(pedido: Record<string, unknown>): LineaVentaWinston | null {
  const raw = pedido.linea_venta ?? pedido.lineaVenta;
  if (raw === 'prendas' || raw === 'tenis' || raw === 'remate_tenis') return raw;
  return inferirLineaVentaDesdeFolio(String(pedido.folio ?? ''));
}

export function pedidoCoincideFiltroLinea(
  pedido: Record<string, unknown>,
  filtro: FiltroLineaVenta
): boolean {
  if (filtro === 'todos') return true;
  const linea = leerLineaVentaPedido(pedido);
  if (filtro === 'tenis') return linea === 'tenis';
  if (filtro === 'remate_tenis') return linea === 'remate_tenis';
  return linea === 'prendas' || linea === null;
}

export function dividirDetallesPorLinea<T extends { prenda_id: string; prenda_nombre?: string }>(
  detalles: T[]
): { prendas: T[]; tenis: T[]; remate_tenis: T[] } {
  const prendas: T[] = [];
  const tenis: T[] = [];
  const remate_tenis: T[] = [];
  for (const d of detalles) {
    if (esPrendaRemateTenis(d.prenda_id, d.prenda_nombre)) {
      remate_tenis.push(d);
    } else if (esPrendaTenis(d.prenda_id, d.prenda_nombre)) {
      tenis.push(d);
    } else {
      prendas.push(d);
    }
  }
  return { prendas, tenis, remate_tenis };
}

export const OPCIONES_FILTRO_LINEA: { value: FiltroLineaVenta; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'prendas', label: 'Prendas' },
  { value: 'tenis', label: 'Tenis' },
  { value: 'remate_tenis', label: 'Remate tenis' },
];

export const OPCIONES_LINEA_CORTE: { value: LineaVentaWinston; label: string }[] = [
  { value: 'prendas', label: 'Prendas (folios wu…)' },
  { value: 'tenis', label: 'Tenis (folios wt…)' },
  { value: 'remate_tenis', label: 'Remate tenis (folios rt…)' },
];

import type { SupabaseClient } from '@supabase/supabase-js';
import { filtrarFilasPorSucursalSiHayColumna } from '@/lib/sucursalCliente';

/** PostgREST devuelve columnas snake_case; APIs a veces solo camelCase en JSON */
export function normalizarCamposCostoApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    id: row.id,
    talla_id: row.talla_id ?? row.tallaId,
    prenda_id: row.prenda_id ?? row.prendaId,
    sucursal_id: row.sucursal_id ?? row.sucursalId,
    stock: row.stock,
    stock_minimo: row.stock_minimo ?? row.stockMinimo,
    stock_inicial: row.stock_inicial ?? row.stockInicial,
    precio_mayoreo: row.precio_mayoreo ?? row.precioMayoreo,
    precio_menudeo: row.precio_menudeo ?? row.precioMenudeo,
    precio_venta: row.precio_venta ?? row.precioVenta,
    precio_compra: row.precio_compra ?? row.precioCompra,
    ubicacion_almacenamiento_id:
      row.ubicacion_almacenamiento_id ?? row.ubicacionAlmacenamientoId,
    activo: row.activo,
    cantidad_venta: row.cantidad_venta ?? row.cantidadVenta,
  };
}

/** Varias filas por talla si hay sucursales; sin columna sucursal → una fila */
export function elegirCostoPrendaTalla<T extends Record<string, unknown>>(
  filas: T[],
  sucursalSesion?: string | null
): T | null {
  if (!filas?.length) return null;
  const norm = filas.map((r) => normalizarCamposCostoApi(r) as T);
  const filtradas = filtrarFilasPorSucursalSiHayColumna(
    norm as unknown as Record<string, unknown>[],
    sucursalSesion ?? undefined
  ) as unknown as T[];
  return filtradas[0] ?? norm[0];
}

/** Busca costo sin usar sucursal_id en la URL (columna puede no existir en InsForge). */
export async function fetchCostoStockModal(
  supabase: SupabaseClient,
  opts: { prendaId: string; tallaId: string; sucursalId?: string | null }
): Promise<Record<string, unknown> | null> {
  const { prendaId, tallaId, sucursalId } = opts;
  const { data, error } = await supabase
    .from('costos')
    .select('*')
    .eq('prenda_id', prendaId)
    .eq('talla_id', tallaId);

  if (error) throw error;
  const picked = elegirCostoPrendaTalla((data || []) as Record<string, unknown>[], sucursalId);
  return picked ? normalizarCamposCostoApi(picked) : null;
}

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Costo por unidad de insumo según presentación (ej. 100 botones / $100 → $1/botón).
 */
export function precioUnitarioInsumo(insumo: {
  costo_compra?: number | null;
  cantidad_por_presentacion?: number | null;
}): number {
  const costo = Number(insumo.costo_compra) || 0;
  const cant = Number(insumo.cantidad_por_presentacion);
  const divisor = cant > 0 ? cant : 1;
  return costo / divisor;
}

/**
 * Costo bruto de una prenda en una talla: Σ (cantidad en receta × costo unitario del insumo).
 */
export function costoBrutoDesdeRecetaInsumos(
  filas: { cantidad: number; costo_compra?: number | null; cantidad_por_presentacion?: number | null }[]
): number {
  let sum = 0;
  for (const f of filas) {
    const c = Number(f.cantidad) || 0;
    sum += c * precioUnitarioInsumo(f);
  }
  return Number(sum.toFixed(4));
}

/**
 * Lee `prenda_talla_insumos` + costos del catálogo de insumos y devuelve el costo bruto por prenda (una unidad).
 * Si no hay receta, devuelve `null` (el llamador puede usar respaldo legacy).
 */
export async function obtenerCostoBrutoPrendaTalla(
  supabase: SupabaseClient,
  prendaId: string,
  tallaId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('prenda_talla_insumos')
    .select('cantidad, insumo:insumos(costo_compra, cantidad_por_presentacion)')
    .eq('prenda_id', prendaId)
    .eq('talla_id', tallaId);

  if (error || !data?.length) return null;

  const filas: { cantidad: number; costo_compra?: number | null; cantidad_por_presentacion?: number | null }[] = [];
  for (const row of data as any[]) {
    const cant = Number(row.cantidad) || 0;
    const ins = row.insumo;
    const insumo = Array.isArray(ins) ? ins[0] : ins;
    if (!insumo) continue;
    filas.push({
      cantidad: cant,
      costo_compra: insumo.costo_compra,
      cantidad_por_presentacion: insumo.cantidad_por_presentacion,
    });
  }

  if (filas.length === 0) return null;
  return costoBrutoDesdeRecetaInsumos(filas);
}

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

export type DiagnosticoRecetaInsumos =
  | { ok: true; costo_bruto_unitario: number }
  | { ok: false; motivo: 'SIN_INSUMOS' | 'INSUMO_SIN_COSTO'; costo_bruto_unitario: null };

function insumoTieneCostoValido(insumo: {
  costo_compra?: number | null;
  cantidad_por_presentacion?: number | null;
}): boolean {
  const costo = Number(insumo.costo_compra);
  const cant = Number(insumo.cantidad_por_presentacion);
  return Number.isFinite(costo) && costo > 0 && Number.isFinite(cant) && cant > 0;
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

/**
 * Igual que `obtenerCostoBrutoPrendaTalla`, pero devuelve un diagnóstico para UI/validaciones:
 * - SIN_INSUMOS: no hay receta asignada en `prenda_talla_insumos`
 * - INSUMO_SIN_COSTO: hay receta, pero algún insumo no tiene costo/presentación válidos
 */
export async function obtenerDiagnosticoRecetaPrendaTalla(
  supabase: SupabaseClient,
  prendaId: string,
  tallaId: string
): Promise<DiagnosticoRecetaInsumos> {
  const { data, error } = await supabase
    .from('prenda_talla_insumos')
    .select('cantidad, insumo:insumos(costo_compra, cantidad_por_presentacion)')
    .eq('prenda_id', prendaId)
    .eq('talla_id', tallaId);

  if (error || !data?.length) {
    return { ok: false, motivo: 'SIN_INSUMOS', costo_bruto_unitario: null };
  }

  const filas: { cantidad: number; costo_compra?: number | null; cantidad_por_presentacion?: number | null }[] = [];
  let hayInsumoSinCosto = false;
  for (const row of data as any[]) {
    const cant = Number(row.cantidad) || 0;
    const ins = row.insumo;
    const insumo = Array.isArray(ins) ? ins[0] : ins;
    if (!insumo) continue;
    if (!insumoTieneCostoValido(insumo)) {
      hayInsumoSinCosto = true;
    }
    filas.push({
      cantidad: cant,
      costo_compra: insumo.costo_compra,
      cantidad_por_presentacion: insumo.cantidad_por_presentacion,
    });
  }

  if (filas.length === 0) {
    return { ok: false, motivo: 'SIN_INSUMOS', costo_bruto_unitario: null };
  }
  if (hayInsumoSinCosto) {
    return { ok: false, motivo: 'INSUMO_SIN_COSTO', costo_bruto_unitario: null };
  }
  return { ok: true, costo_bruto_unitario: costoBrutoDesdeRecetaInsumos(filas) };
}

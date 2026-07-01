import { filtrarFilasPorSucursalSiHayColumna } from '@/lib/sucursalCliente';
import type { Block3Database } from '@/lib/insforgeBrowser';

/** Cliente PostgREST InsForge (`database`) o compatible Supabase. */
export type CostoDbClient = Block3Database;

/** PostgREST devuelve columnas snake_case; APIs a veces solo camelCase en JSON */
export function normalizarCamposCostoApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    id: row.id,
    talla_id: row.talla_id ?? row.tallaId ?? row.TallaId,
    prenda_id: row.prenda_id ?? row.prendaId ?? row.PrendaId,
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
  if (sucursalSesion?.trim()) {
    return filtradas[0] ?? null;
  }
  return filtradas[0] ?? norm[0];
}

const PARES_PRENDA_TALLA: [string, string][] = [
  ['prenda_id', 'talla_id'],
  ['prendaId', 'tallaId'],
  ['prenda_id', 'tallaId'],
  ['prendaId', 'talla_id'],
];

/** Todas las filas costo de una prenda; prueba columnas snake_case y camelCase (InsForge). */
export async function fetchCostosRowsByPrenda(
  db: CostoDbClient,
  prendaId: string
): Promise<Record<string, unknown>[]> {
  for (const col of ['prenda_id', 'prendaId'] as const) {
    const res = await db.from('costos').select('*').eq(col, prendaId);
    if (res.error) continue;
    if ((res.data || []).length > 0) return (res.data || []) as Record<string, unknown>[];
  }
  const last = await db.from('costos').select('*').eq('prenda_id', prendaId);
  if (!last.error) return (last.data || []) as Record<string, unknown>[];
  const last2 = await db.from('costos').select('*').eq('prendaId', prendaId);
  return (last2.data || []) as Record<string, unknown>[];
}

async function fetchCostosRawPrendaYTalla(
  db: CostoDbClient,
  prendaId: string,
  tallaId: string
): Promise<Record<string, unknown>[]> {
  for (const [pc, tc] of PARES_PRENDA_TALLA) {
    const res = await db.from('costos').select('*').eq(pc, prendaId).eq(tc, tallaId);
    if (res.error) continue;
    const rows = (res.data || []) as Record<string, unknown>[];
    if (rows.length > 0) return rows;
  }
  const fallback = await db
    .from('costos')
    .select('*')
    .eq('prenda_id', prendaId)
    .eq('talla_id', tallaId);
  if (!fallback.error) return (fallback.data || []) as Record<string, unknown>[];
  return [];
}

/** Busca costo sin usar sucursal_id en la URL (columna puede no existir en InsForge). */
export async function fetchCostoStockModal(
  db: CostoDbClient,
  opts: { prendaId: string; tallaId: string; sucursalId?: string | null }
): Promise<Record<string, unknown> | null> {
  const { prendaId, tallaId, sucursalId } = opts;
  const rows = await fetchCostosRawPrendaYTalla(db, prendaId, tallaId);
  const picked = elegirCostoPrendaTalla(rows, sucursalId);
  return picked ? normalizarCamposCostoApi(picked) : null;
}

/** Tallas con al menos un costo activo (cualquier sucursal). */
export function extraerTallasActivasDeCostos(rows: Record<string, unknown>[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    const n = normalizarCamposCostoApi(r);
    if (n.activo === false) continue;
    const tid = n.talla_id;
    if (tid != null && tid !== '') ids.add(String(tid));
  }
  return [...ids];
}

/** IDs de costo a eliminar/desactivar al quitar tallas de una prenda (todas las sucursales). */
export async function fetchCostosIdsParaEliminarTallas(
  db: CostoDbClient,
  prendaId: string,
  tallaIds: string[]
): Promise<string[]> {
  if (!tallaIds.length) return [];
  const tallaSet = new Set(tallaIds);
  const rows = await fetchCostosRowsByPrenda(db, prendaId);
  return rows
    .map((r) => normalizarCamposCostoApi(r))
    .filter((n) => n.id && tallaSet.has(String(n.talla_id)) && n.activo !== false)
    .map((n) => String(n.id));
}

export async function fetchTallasActivasDePrenda(
  db: CostoDbClient,
  prendaId: string
): Promise<string[]> {
  const rows = await fetchCostosRowsByPrenda(db, prendaId);
  return extraerTallasActivasDeCostos(rows);
}

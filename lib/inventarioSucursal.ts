import { filtrarFilasPorSucursalSiHayColumna } from '@/lib/sucursalCliente';
import { puedeGestionarCatalogo } from '@/lib/permisos';
import type { SesionUsuario } from '@/lib/types';

export type OpcionesInventarioTienda = {
  sucursalId?: string | null;
  esMatriz?: boolean;
  /** Matriz en gestión: catálogo global de prendas. */
  catalogoCompleto?: boolean;
  /** Gestión en sucursal: costos de la tienda aunque stock sea 0. Ventas: solo stock > 0. */
  incluirStockCero?: boolean;
};

export function opcionesInventarioDesdeSesion(
  sesion: SesionUsuario | null | undefined,
  modo: 'gestion' | 'venta' = 'gestion'
): OpcionesInventarioTienda {
  const enMatriz = Boolean(sesion?.es_matriz);
  const gestion = modo === 'gestion';
  return {
    sucursalId: sesion?.sucursal_id,
    esMatriz: enMatriz,
    catalogoCompleto: enMatriz && gestion,
    incluirStockCero: gestion && puedeGestionarCatalogo(sesion),
  };
}

function readPrendaId(row: Record<string, unknown>): string | null {
  const v = row.prenda_id ?? row.prendaId;
  if (v == null || v === '') return null;
  return String(v).trim();
}

export function filtrarCostosInventarioTienda<T extends Record<string, unknown>>(
  rows: T[],
  opts?: OpcionesInventarioTienda
): T[] {
  const filtradas = filtrarFilasPorSucursalSiHayColumna(rows, opts?.sucursalId);
  if (opts?.esMatriz === false && !opts?.incluirStockCero) {
    return filtradas.filter((r) => Number(r.stock ?? 0) > 0);
  }
  return filtradas;
}

export function prendaIdsDesdeCostos(rows: Record<string, unknown>[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    const pid = readPrendaId(r);
    if (pid) ids.add(pid);
  }
  return [...ids];
}

export function normalizarPrendaIdKey(id: string): string {
  return id.trim().toLowerCase();
}

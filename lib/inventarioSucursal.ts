import { filtrarFilasPorSucursalSiHayColumna } from '@/lib/sucursalCliente';
import { puedeGestionarCatalogo } from '@/lib/permisos';
import type { SesionUsuario } from '@/lib/types';

export type OpcionesInventarioTienda = {
  sucursalId?: string | null;
  esMatriz?: boolean;
  /** Winston en modo gestión: catálogo completo y costos de su tienda (incluye stock 0). */
  gestionaCatalogo?: boolean;
};

export function opcionesInventarioDesdeSesion(
  sesion: SesionUsuario | null | undefined,
  modo: 'gestion' | 'venta' = 'gestion'
): OpcionesInventarioTienda {
  const gestionaCatalogo = puedeGestionarCatalogo(sesion) && modo === 'gestion';
  return {
    sucursalId: sesion?.sucursal_id,
    esMatriz: sesion?.es_matriz,
    gestionaCatalogo,
  };
}

function readPrendaId(row: Record<string, unknown>): string | null {
  const v = row.prenda_id ?? row.prendaId;
  if (v == null || v === '') return null;
  return String(v).trim();
}

/** Matriz: costos de la tienda (incluye stock 0). Sucursal: solo filas con stock > 0 (transferido/recibido). */
export function filtrarCostosInventarioTienda<T extends Record<string, unknown>>(
  rows: T[],
  opts?: OpcionesInventarioTienda
): T[] {
  const filtradas = filtrarFilasPorSucursalSiHayColumna(rows, opts?.sucursalId);
  if (opts?.esMatriz === false && !opts?.gestionaCatalogo) {
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

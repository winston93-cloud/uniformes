import { filtrarFilasPorSucursalSiHayColumna } from '@/lib/sucursalCliente';
import { esCuentaWinston } from '@/lib/winstonLineaVenta';
import type { SesionUsuario } from '@/lib/types';

export type OpcionesInventarioTienda = {
  sucursalId?: string | null;
  esMatriz?: boolean;
  /** Matriz (uniformes/mario): catálogo global de prendas en gestión. */
  catalogoCompleto?: boolean;
  /** Solo winston: listar solo prendas/costos de SUC-WIN (vacío hasta dar de alta). */
  inventarioSoloSucursalWinston?: boolean;
  /** Costos de la tienda aunque stock sea 0 (gestión). Ventas: solo stock > 0. */
  incluirStockCero?: boolean;
};

export function opcionesInventarioDesdeSesion(
  sesion: SesionUsuario | null | undefined,
  modo: 'gestion' | 'venta' = 'gestion'
): OpcionesInventarioTienda {
  const gestion = modo === 'gestion';

  // Matriz (uniformes / mario): comportamiento original, sin cambios.
  if (sesion?.es_matriz) {
    return {
      sucursalId: sesion.sucursal_id,
      esMatriz: true,
      catalogoCompleto: gestion,
      incluirStockCero: gestion,
    };
  }

  // Solo cuenta winston @ SUC-WIN: inventario propio vacío + botones de alta.
  if (esCuentaWinston(sesion)) {
    return {
      sucursalId: sesion?.sucursal_id,
      esMatriz: false,
      catalogoCompleto: false,
      inventarioSoloSucursalWinston: true,
      incluirStockCero: gestion,
    };
  }

  return {
    sucursalId: sesion?.sucursal_id,
    esMatriz: false,
    incluirStockCero: false,
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

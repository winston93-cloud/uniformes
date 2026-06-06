import type { Costo, Talla } from '@/lib/types';

export type TallaOrdenable = {
  nombre?: string | null;
  orden?: number | null;
};

/** Orden de tallas de vestir (fallback si `tallas.orden` no está definido). */
const RANGO_TALLA_LETRAS: Record<string, number> = {
  XXCH: 5,
  '2XCH': 6,
  XXXCH: 4,
  XCH: 10,
  'XCH/XX': 10,
  CH: 20,
  KCH: 21,
  CHICA: 20,
  P: 22,
  S: 25,
  PEQUENA: 25,
  PEQUEÑA: 25,
  M: 30,
  KM: 31,
  MED: 30,
  MEDIANA: 30,
  G: 40,
  KG: 41,
  GR: 40,
  GRANDE: 40,
  L: 45,
  XG: 50,
  X: 50,
  XL: 50,
  EG: 50,
  EXTRA_GRANDE: 50,
  'EXTRA GRANDE': 50,
  XXG: 60,
  XXL: 60,
  '2XL': 60,
  XXXG: 70,
  XXXL: 70,
  '3XL': 70,
  '4XL': 75,
  '5XL': 80,
  ESPECIAL: 900,
  ESP: 900,
  UNICA: 910,
  ÚNICA: 910,
  UNITALLA: 920,
  'UNI TALLA': 920,
};

function normalizarNombreTalla(nombre: string): string {
  return nombre.trim().toUpperCase().replace(/\s+/g, ' ');
}

function esTallaNumerica(nombre: string): boolean {
  return /^\d+$/.test(nombre.trim());
}

/** Rangos tipo "10-12" o "4-6": ordena por el primer número. */
function rangoNumericoCompuesto(nombre: string): number | null {
  const m = nombre.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!m) return null;
  return Number(m[1]);
}

function rangoFallbackLetras(nombre: string): number {
  const n = normalizarNombreTalla(nombre);
  if (RANGO_TALLA_LETRAS[n] !== undefined) return RANGO_TALLA_LETRAS[n];
  return 500;
}

/**
 * Compara tallas como en catálogo de ropa:
 * 1) numéricas (4, 6, 8…)
 * 2) rangos (10-12)
 * 3) mapa de tallas de vestir (XCH, CH, M, G, XG, XXL…, ESPECIAL)
 * 4) campo `orden` del catálogo (tallas desconocidas)
 */
export function compararTallas(
  a: TallaOrdenable | null | undefined,
  b: TallaOrdenable | null | undefined
): number {
  const nomA = (a?.nombre || '').trim();
  const nomB = (b?.nombre || '').trim();
  if (!nomA && !nomB) return 0;
  if (!nomA) return 1;
  if (!nomB) return -1;

  const numA = esTallaNumerica(nomA);
  const numB = esTallaNumerica(nomB);
  if (numA && numB) return Number(nomA) - Number(nomB);
  if (numA && !numB) return -1;
  if (!numA && numB) return 1;

  const rangoA = rangoNumericoCompuesto(nomA);
  const rangoB = rangoNumericoCompuesto(nomB);
  if (rangoA != null && rangoB != null && rangoA !== rangoB) return rangoA - rangoB;
  if (rangoA != null && rangoB == null) return -1;
  if (rangoA == null && rangoB != null) return 1;

  const rankA = rangoFallbackLetras(nomA);
  const rankB = rangoFallbackLetras(nomB);
  const esConocidaA = rankA !== 500;
  const esConocidaB = rankB !== 500;
  if (esConocidaA && esConocidaB && rankA !== rankB) return rankA - rankB;
  if (esConocidaA && !esConocidaB) return -1;
  if (!esConocidaA && esConocidaB) return 1;

  const ordA = Number(a?.orden);
  const ordB = Number(b?.orden);
  const tieneOrdA = Number.isFinite(ordA) && ordA > 0;
  const tieneOrdB = Number.isFinite(ordB) && ordB > 0;
  if (tieneOrdA && tieneOrdB && ordA !== ordB) return ordA - ordB;
  if (tieneOrdA && !tieneOrdB) return -1;
  if (!tieneOrdA && tieneOrdB) return 1;

  if (rankA !== rankB) return rankA - rankB;

  return nomA.localeCompare(nomB, 'es', { sensitivity: 'base', numeric: true });
}

export function sortTallas<T extends TallaOrdenable>(tallas: T[]): T[] {
  return [...tallas].sort(compararTallas);
}

export function sortCostosPorTalla(costos: Costo[]): Costo[] {
  return [...costos].sort((a, b) => compararTallas(a.talla, b.talla));
}

export function sortTallaRecords(tallas: Talla[]): Talla[] {
  return sortTallas(tallas);
}

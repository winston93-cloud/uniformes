import type { Conjunto, ConjuntoPrecio } from '@/lib/types';

export type LineaCarritoConjunto = {
  prenda_id: string;
  talla_id: string;
  cantidad: number;
  /** Precio unitario de lista (individual). */
  precio_lista?: number;
  precio: number;
  total: number;
  conjunto_id?: string | null;
  conjunto_nombre?: string | null;
  unidades_en_conjunto?: number;
  es_descuento_conjunto?: boolean;
  /** Campos de UI / carrito de pedidos */
  prenda?: string;
  talla?: string;
  especificaciones?: string;
  pendiente?: number;
  cantidad_con_stock?: number;
  cantidad_pendiente?: number;
  tiene_stock?: boolean;
  costoId?: string;
};

function precioConjuntoTalla(precios: ConjuntoPrecio[] | undefined, tallaId: string): number | null {
  const row = (precios ?? []).find((p) => p.talla_id === tallaId);
  if (!row) return null;
  const n = Number(row.precio_venta ?? row.precio_menudeo ?? row.precio_mayoreo ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function listaDe(l: LineaCarritoConjunto): number {
  return Number.isFinite(l.precio_lista) ? Number(l.precio_lista) : Number(l.precio) || 0;
}

export function esLineaDescuentoConjunto(l: { es_descuento_conjunto?: boolean; prenda_id?: string }): boolean {
  if (l.es_descuento_conjunto) return true;
  const id = String(l.prenda_id ?? '').trim();
  return id === '' || id === 'descuento-conjunto';
}

/**
 * Mantiene precios individuales de las prendas y agrega partidas
 * "Descuento x conjunto" = (suma individual − precio conjunto) × pares.
 */
export function aplicarDescuentosConjuntoALineas<T extends LineaCarritoConjunto>(
  lineas: T[],
  conjuntos: Conjunto[]
): T[] {
  const productos = lineas
    .filter((l) => !esLineaDescuentoConjunto(l))
    .map((l) => {
      const lista = listaDe(l);
      return {
        ...l,
        precio_lista: lista,
        precio: lista,
        total: round2(l.cantidad * lista),
        conjunto_id: null as string | null,
        conjunto_nombre: null as string | null,
        unidades_en_conjunto: 0,
        es_descuento_conjunto: false,
      } as T;
    });

  if (!productos.length || !conjuntos.length) {
    return productos;
  }

  const descuentos: T[] = [];
  const activos = conjuntos.filter((c) => c.activo !== false);

  for (const cj of activos) {
    const tallas = new Set(
      productos
        .filter((l) => l.prenda_id === cj.prenda_a_id || l.prenda_id === cj.prenda_b_id)
        .map((l) => l.talla_id)
    );

    for (const tallaId of tallas) {
      const precioCj = precioConjuntoTalla(cj.precios, tallaId);
      if (precioCj == null) continue;

      const lineasA = productos.filter((l) => l.prenda_id === cj.prenda_a_id && l.talla_id === tallaId);
      const lineasB = productos.filter((l) => l.prenda_id === cj.prenda_b_id && l.talla_id === tallaId);
      if (!lineasA.length || !lineasB.length) continue;

      const qtyA = lineasA.reduce((s, l) => s + l.cantidad, 0);
      const qtyB = lineasB.reduce((s, l) => s + l.cantidad, 0);
      const pares = Math.min(qtyA, qtyB);
      if (pares <= 0) continue;

      const listaA = listaDe(lineasA[0]);
      const listaB = listaDe(lineasB[0]);
      const descuentoUnit = round2(listaA + listaB - precioCj);
      if (descuentoUnit <= 0) continue;

      const tallaNombre = lineasA[0].talla || lineasB[0].talla || '';

      for (const l of [...lineasA, ...lineasB]) {
        const i = productos.indexOf(l);
        if (i < 0) continue;
        productos[i] = {
          ...productos[i],
          conjunto_id: cj.id,
          conjunto_nombre: cj.nombre,
          unidades_en_conjunto: Math.min(l.cantidad, pares),
        } as T;
      }

      descuentos.push({
        ...(productos[0] as T),
        prenda: 'Descuento x conjunto',
        prenda_id: 'descuento-conjunto',
        talla: tallaNombre,
        talla_id: tallaId,
        especificaciones: cj.nombre,
        cantidad: pares,
        pendiente: 0,
        precio: -descuentoUnit,
        precio_lista: 0,
        total: round2(-descuentoUnit * pares),
        costoId: undefined,
        tiene_stock: false,
        cantidad_con_stock: 0,
        cantidad_pendiente: 0,
        conjunto_id: cj.id,
        conjunto_nombre: cj.nombre,
        unidades_en_conjunto: pares,
        es_descuento_conjunto: true,
      } as T);
    }
  }

  return [...productos, ...descuentos];
}

/** @deprecated Usar aplicarDescuentosConjuntoALineas */
export const aplicarPreciosConjuntoALineas = aplicarDescuentosConjuntoALineas;

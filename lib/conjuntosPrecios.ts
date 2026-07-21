import type { Conjunto, ConjuntoPrecio } from '@/lib/types';

export type LineaCarritoConjunto = {
  prenda_id: string;
  talla_id: string;
  cantidad: number;
  /** Precio unitario de lista (individual), antes de descuento conjunto. */
  precio_lista?: number;
  precio: number;
  total: number;
  conjunto_id?: string | null;
  conjunto_nombre?: string | null;
  unidades_en_conjunto?: number;
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

/**
 * Recalcula precios del carrito: si hay pantalón + chamarra de un conjunto
 * en la misma talla, las unidades pareadas usan el precio de conjunto
 * (repartido proporcionalmente entre ambas prendas).
 */
export function aplicarPreciosConjuntoALineas<T extends LineaCarritoConjunto>(
  lineas: T[],
  conjuntos: Conjunto[]
): T[] {
  if (!lineas.length || !conjuntos.length) {
    return lineas.map((l) => {
      const lista = listaDe(l);
      return {
        ...l,
        precio_lista: lista,
        precio: lista,
        total: round2(l.cantidad * lista),
        conjunto_id: null,
        conjunto_nombre: null,
        unidades_en_conjunto: 0,
      };
    });
  }

  const out: T[] = lineas.map((l) => {
    const lista = listaDe(l);
    return {
      ...l,
      precio_lista: lista,
      precio: lista,
      total: round2(l.cantidad * lista),
      conjunto_id: null,
      conjunto_nombre: null,
      unidades_en_conjunto: 0,
    };
  });

  const activos = conjuntos.filter((c) => c.activo !== false);

  for (const cj of activos) {
    const tallas = new Set(
      out
        .filter((l) => l.prenda_id === cj.prenda_a_id || l.prenda_id === cj.prenda_b_id)
        .map((l) => l.talla_id)
    );

    for (const tallaId of tallas) {
      const precioCj = precioConjuntoTalla(cj.precios, tallaId);
      if (precioCj == null) continue;

      const idxA = out
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => l.prenda_id === cj.prenda_a_id && l.talla_id === tallaId);
      const idxB = out
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => l.prenda_id === cj.prenda_b_id && l.talla_id === tallaId);

      if (idxA.length === 0 || idxB.length === 0) continue;

      const qtyA = idxA.reduce((s, x) => s + x.l.cantidad, 0);
      const qtyB = idxB.reduce((s, x) => s + x.l.cantidad, 0);
      const pares = Math.min(qtyA, qtyB);
      if (pares <= 0) continue;

      const listaA = listaDe(idxA[0].l);
      const listaB = listaDe(idxB[0].l);
      const sumaLista = listaA + listaB;
      const parteA = sumaLista > 0 ? round2(precioCj * (listaA / sumaLista)) : round2(precioCj / 2);
      const parteB = round2(precioCj - parteA);

      const aplicarBlend = (
        indices: { l: T; i: number }[],
        qtyTotal: number,
        partePar: number,
        lista: number
      ) => {
        if (qtyTotal <= 0) return;
        const unit = round2((pares * partePar + (qtyTotal - pares) * lista) / qtyTotal);
        for (const { i } of indices) {
          const cant = out[i].cantidad;
          out[i] = {
            ...out[i],
            precio: unit,
            total: round2(cant * unit),
            conjunto_id: cj.id,
            conjunto_nombre: cj.nombre,
            unidades_en_conjunto: Math.min(cant, pares),
          };
        }
      };

      aplicarBlend(idxA, qtyA, parteA, listaA);
      aplicarBlend(idxB, qtyB, parteB, listaB);
    }
  }

  return out;
}

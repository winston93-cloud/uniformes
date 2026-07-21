'use client';

import { useCallback, useEffect, useState } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Conjunto, ConjuntoPrecio } from '@/lib/types';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapPrecio(row: Record<string, unknown>): ConjuntoPrecio {
  return {
    id: String(row.id),
    conjunto_id: String(row.conjunto_id ?? row.conjuntoId ?? ''),
    talla_id: String(row.talla_id ?? row.tallaId ?? ''),
    precio_mayoreo: num(row.precio_mayoreo ?? row.precioMayoreo),
    precio_menudeo: num(row.precio_menudeo ?? row.precioMenudeo),
    precio_venta: num(row.precio_venta ?? row.precioVenta),
    talla: (row.talla as ConjuntoPrecio['talla']) ?? null,
  };
}

function mapConjunto(row: Record<string, unknown>, precios: ConjuntoPrecio[]): Conjunto {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    codigo: row.codigo != null ? String(row.codigo) : null,
    prenda_a_id: String(row.prenda_a_id ?? row.prendaAId ?? ''),
    prenda_b_id: String(row.prenda_b_id ?? row.prendaBId ?? ''),
    activo: row.activo !== false,
    notas: row.notas != null ? String(row.notas) : null,
    prenda_a: (row.prenda_a as Conjunto['prenda_a']) ?? null,
    prenda_b: (row.prenda_b as Conjunto['prenda_b']) ?? null,
    precios,
  };
}

export function useConjuntos() {
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConjuntos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await insforgeDb()
        .from('conjuntos')
        .select(
          `
          *,
          prenda_a:prendas!conjuntos_prenda_a_id_fkey(id, nombre, codigo),
          prenda_b:prendas!conjuntos_prenda_b_id_fkey(id, nombre, codigo),
          precios:conjunto_precios(*, talla:tallas(id, nombre, orden))
        `
        )
        .order('nombre');

      if (err) {
        // Fallback sin embeds si los nombres de FK no coinciden
        const plain = await insforgeDb().from('conjuntos').select('*').order('nombre');
        if (plain.error) throw plain.error;
        const ids = (plain.data || []).map((r: { id: string }) => r.id);
        let preciosRows: Record<string, unknown>[] = [];
        if (ids.length) {
          const pr = await insforgeDb().from('conjunto_precios').select('*').in('conjunto_id', ids);
          if (!pr.error) preciosRows = (pr.data || []) as Record<string, unknown>[];
        }
        const mapped = ((plain.data || []) as Record<string, unknown>[]).map((row) => {
          const cid = String(row.id);
          return mapConjunto(
            row,
            preciosRows.filter((p) => String(p.conjunto_id) === cid).map(mapPrecio)
          );
        });
        setConjuntos(mapped);
        setError(null);
        return;
      }

      const mapped = ((data || []) as Record<string, unknown>[]).map((row) => {
        const preciosRaw = Array.isArray(row.precios) ? row.precios : [];
        return mapConjunto(
          row,
          (preciosRaw as Record<string, unknown>[]).map(mapPrecio)
        );
      });
      setConjuntos(mapped);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.error('Error fetchConjuntos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConjuntos();
  }, [fetchConjuntos]);

  const crearConjunto = async (payload: {
    nombre: string;
    codigo?: string | null;
    prenda_a_id: string;
    prenda_b_id: string;
    notas?: string | null;
    precios: Array<{
      talla_id: string;
      precio_mayoreo: number;
      precio_menudeo: number;
      precio_venta: number;
    }>;
  }) => {
    try {
      const { data, error: err } = await insforgeDb()
        .from('conjuntos')
        .insert([
          {
            nombre: payload.nombre.trim().toUpperCase(),
            codigo: payload.codigo?.trim() || null,
            prenda_a_id: payload.prenda_a_id,
            prenda_b_id: payload.prenda_b_id,
            notas: payload.notas || null,
            activo: true,
          },
        ])
        .select()
        .single();
      if (err) throw err;

      const preciosValidos = payload.precios.filter((p) => p.precio_venta > 0 || p.precio_menudeo > 0);
      if (preciosValidos.length) {
        const { error: errP } = await insforgeDb().from('conjunto_precios').insert(
          preciosValidos.map((p) => ({
            conjunto_id: data.id,
            talla_id: p.talla_id,
            precio_mayoreo: p.precio_mayoreo,
            precio_menudeo: p.precio_menudeo,
            precio_venta: p.precio_venta || p.precio_menudeo || p.precio_mayoreo,
          }))
        );
        if (errP) throw errP;
      }
      await fetchConjuntos();
      return { ok: true as const, id: data.id as string };
    } catch (e: unknown) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const actualizarConjunto = async (
    id: string,
    payload: {
      nombre: string;
      codigo?: string | null;
      prenda_a_id: string;
      prenda_b_id: string;
      activo: boolean;
      notas?: string | null;
      precios: Array<{
        talla_id: string;
        precio_mayoreo: number;
        precio_menudeo: number;
        precio_venta: number;
      }>;
    }
  ) => {
    try {
      const { error: err } = await insforgeDb()
        .from('conjuntos')
        .update({
          nombre: payload.nombre.trim().toUpperCase(),
          codigo: payload.codigo?.trim() || null,
          prenda_a_id: payload.prenda_a_id,
          prenda_b_id: payload.prenda_b_id,
          activo: payload.activo,
          notas: payload.notas || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (err) throw err;

      const { error: errDel } = await insforgeDb()
        .from('conjunto_precios')
        .delete()
        .eq('conjunto_id', id);
      if (errDel) throw errDel;

      const preciosValidos = payload.precios.filter((p) => p.precio_venta > 0 || p.precio_menudeo > 0);
      if (preciosValidos.length) {
        const { error: errP } = await insforgeDb().from('conjunto_precios').insert(
          preciosValidos.map((p) => ({
            conjunto_id: id,
            talla_id: p.talla_id,
            precio_mayoreo: p.precio_mayoreo,
            precio_menudeo: p.precio_menudeo,
            precio_venta: p.precio_venta || p.precio_menudeo || p.precio_mayoreo,
          }))
        );
        if (errP) throw errP;
      }
      await fetchConjuntos();
      return { ok: true as const };
    } catch (e: unknown) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const eliminarConjunto = async (id: string) => {
    try {
      const { error: err } = await insforgeDb().from('conjuntos').delete().eq('id', id);
      if (err) throw err;
      await fetchConjuntos();
      return { ok: true as const };
    } catch (e: unknown) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  };

  return {
    conjuntos,
    loading,
    error,
    fetchConjuntos,
    crearConjunto,
    actualizarConjunto,
    eliminarConjunto,
  };
}

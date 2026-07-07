'use client';

import { useState, useEffect } from 'react';
import { fetchCostosRowsByPrenda, normalizarCamposCostoApi } from '@/lib/costoQueries';
import { filtrarCostosInventarioTienda, normalizarPrendaIdKey, type OpcionesInventarioTienda } from '@/lib/inventarioSucursal';
import { normalizarCamposPrendaApi } from '@/lib/insforgeNormalize';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { CategoriaPrenda, Prenda } from '../types';

/** InsForge / SDK pueden devolver camelCase o UUID con distinta capitalización → normalizar antes de hacer Map.get */
function normalizeUuidKey(id: string): string {
  return String(id).trim().toLowerCase();
}

/** UUID v4 aproximado (InsForge puede mandar el FK en cualquier campo con nombre raro). */
function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

function readCategoriaIdFk(row: Record<string, unknown>): string | null {
  const direct =
    row.categoria_id ??
    row.categoriaId ??
    row['categoria_Id'] ??
    row.category_id ??
    row.categoryId ??
    row.CategoriaId ??
    row.CategoryId ??
    row.categoriaPrendaId ??
    row.categoria_prenda_id ??
    row.CategoriaPrendaId;
  if (direct != null && direct !== '') return String(direct).trim();

  for (const [key, val] of Object.entries(row)) {
    if (val == null || val === '') continue;
    const kl = key.toLowerCase();
    if (
      kl.includes('categoria') &&
      kl.includes('id') &&
      typeof val !== 'object'
    ) {
      const s = String(val).trim();
      if (s.length && looksLikeUuid(s)) return s;
    }
  }
  return null;
}

/** Si InsForge devuelve la fila relacionada embebida (nombre distinto al embed PostgREST clásico). */
function readCategoriaNested(row: Record<string, unknown>): CategoriaPrenda | undefined {
  const candidates = [
    row.categorias_prendas,
    row.categoria_prenda,
    row.categoriaPrenda,
    row.CategoriasPrendas,
    row.categoria,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const obj = Array.isArray(c) ? c[0] : c;
    if (obj && typeof obj === 'object') {
      const o = obj as Record<string, unknown>;
      const nombre = o.nombre ?? o.Nombre;
      const id = o.id ?? o.Id ?? o.ID;
      if ((nombre != null && String(nombre).trim() !== '') || id != null) {
        return rowACategoriaPrenda(o);
      }
    }
  }
  return undefined;
}

/** Último recurso: algún valor del objeto es UUID que coincide con una categoría cargada (FK con nombre no estándar). */
function categoriaPorUuidEnValores(
  row: Record<string, unknown>,
  catById: Map<string, CategoriaPrenda>
): CategoriaPrenda | undefined {
  for (const val of Object.values(row)) {
    if (typeof val !== 'string' && typeof val !== 'number') continue;
    const s = String(val).trim();
    if (!looksLikeUuid(s)) continue;
    const hit = catById.get(normalizeUuidKey(s));
    if (hit) return hit;
  }
  return undefined;
}

/** Texto legado si la BD aún tiene columna `categoria` sin migrar a UUID */
function readNombreCategoriaLegacy(row: Record<string, unknown>): string | null {
  const v = row.categoria ?? row.Categoria;
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return String(v).trim() || null;
}

function rowACategoriaPrenda(c: Record<string, unknown>): CategoriaPrenda {
  const idVal = c.id ?? c.Id ?? c.ID;
  return {
    ...(c as object),
    id: idVal != null ? String(idVal).trim() : '',
    nombre: String(c.nombre ?? c.Nombre ?? ''),
    activo: Boolean(c.activo ?? c.Activo ?? true),
  } as CategoriaPrenda;
}

/** InsForge: sin embed; categorías en paralelo. Si existe solo `categoria` VARCHAR, enlazamos por nombre. */
export function usePrendas(opts?: OpcionesInventarioTienda) {
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sucursalId = opts?.sucursalId;
  const esMatriz = opts?.esMatriz;
  const catalogoCompleto = opts?.catalogoCompleto;
  const incluirStockCero = opts?.incluirStockCero;

  const fetchPrendas = async () => {
    try {
      setLoading(true);
      const [preResFirst, catRes] = await Promise.all([
        insforgeDb().from('prendas').select('*, categorias_prendas(*)').order('nombre', { ascending: true }),
        insforgeDb().from('categorias_prendas').select('*'),
      ]);
      const preRes = preResFirst.error
        ? await insforgeDb().from('prendas').select('*').order('nombre', { ascending: true })
        : preResFirst;
      if (preRes.error) throw preRes.error;
      if (catRes.error) throw catRes.error;

      const prendasRows = preRes.data || [];
      const categoriasRows = catRes.data || [];

      const catById = new Map<string, CategoriaPrenda>();
      const catByNombreNorm = new Map<string, CategoriaPrenda>();
      for (const c of categoriasRows) {
        const raw = c as Record<string, unknown>;
        const cat = rowACategoriaPrenda(raw);
        if (cat.id) catById.set(normalizeUuidKey(cat.id), cat);
        const nn = cat.nombre.trim().toLowerCase();
        if (nn) catByNombreNorm.set(nn, cat);
      }

      /** FKs en prendas que no aparecieron en el listado global (RLS, paginación del API, etc.) */
      const fkDesdePrendas = new Set<string>();
      for (const pr of prendasRows) {
        const fk = readCategoriaIdFk(pr as Record<string, unknown>);
        if (fk) fkDesdePrendas.add(normalizeUuidKey(fk));
      }
      const idsFaltantes = [...fkDesdePrendas].filter((id) => !catById.has(id));
      if (idsFaltantes.length > 0) {
        const { data: catExtra, error: errExtra } = await insforgeDb()
          .from('categorias_prendas')
          .select('*')
          .in('id', idsFaltantes);
        if (!errExtra && catExtra?.length) {
          for (const c of catExtra) {
            const raw = c as Record<string, unknown>;
            const cat = rowACategoriaPrenda(raw);
            if (cat.id) catById.set(normalizeUuidKey(cat.id), cat);
            const nn = cat.nombre.trim().toLowerCase();
            if (nn) catByNombreNorm.set(nn, cat);
          }
        }
      }

      const mapped: Prenda[] = prendasRows.map((row) => {
        const raw = normalizarCamposPrendaApi(row as Record<string, unknown>);
        const fk = readCategoriaIdFk(raw);
        let cat: CategoriaPrenda | undefined = fk ? catById.get(normalizeUuidKey(fk)) : undefined;
        if (!cat) cat = readCategoriaNested(raw);
        if (!cat) cat = categoriaPorUuidEnValores(raw, catById);
        if (!cat) {
          const legacyNombre = readNombreCategoriaLegacy(raw);
          if (legacyNombre) {
            cat =
              catByNombreNorm.get(legacyNombre.toLowerCase()) ??
              ({
                id: '',
                nombre: legacyNombre,
                activo: true,
              } as CategoriaPrenda);
          }
        }
        const r = row as Prenda;
        const resolvedCategoriaId =
          fk ??
          (cat?.id && String(cat.id).trim() !== '' ? cat.id : null) ??
          (r.categoria_id != null ? String(r.categoria_id).trim() : null);
        const activoRaw = raw.activo ?? raw.Activo;
        return {
          ...r,
          activo: activoRaw === undefined || activoRaw === null ? true : Boolean(activoRaw),
          categoria_id: resolvedCategoriaId,
          categoria: cat,
        };
      });

      let resultado = mapped;
      if (!catalogoCompleto && sucursalId?.trim()) {
        const { data: costosRaw, error: costosErr } = await insforgeDb().from('costos').select('*');
        if (costosErr) throw costosErr;
        const costosTienda = filtrarCostosInventarioTienda(
          (costosRaw || []) as Record<string, unknown>[],
          { sucursalId, esMatriz: false, incluirStockCero }
        );
        const idsInventario = new Set(
          costosTienda
            .map((c) => {
              const n = normalizarCamposCostoApi(c);
              const pid = n.prenda_id;
              return pid != null ? normalizarPrendaIdKey(String(pid)) : '';
            })
            .filter(Boolean)
        );
        resultado = mapped.filter((p) => idsInventario.has(normalizarPrendaIdKey(String(p.id))));
      }

      setPrendas(resultado);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching prendas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrendas();
  }, [sucursalId, esMatriz, catalogoCompleto, incluirStockCero]);

  const createPrenda = async (prenda: Omit<Prenda, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await insforgeDb()
        .from('prendas')
        .insert([prenda])
        .select()
        .single();

      if (error) throw error;
      await fetchPrendas();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updatePrenda = async (id: string, updates: Partial<Prenda>) => {
    try {
      const { data, error } = await insforgeDb()
        .from('prendas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchPrendas();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deletePrenda = async (id: string) => {
    try {
      // 1. Eliminar detalle_pedidos por prenda_id (relación directa)
      const { error: detallePrendaError } = await insforgeDb()
        .from('detalle_pedidos')
        .delete()
        .eq('prenda_id', id);

      if (detallePrendaError) throw detallePrendaError;

      // 2. Obtener todos los costos de la prenda (InsForge: columna prenda_id o prendaId)
      const costosRows = await fetchCostosRowsByPrenda(insforgeDb(), id);
      const costosIds = costosRows
        .map((c) => {
          const n = normalizarCamposCostoApi(c as Record<string, unknown>);
          return n.id != null ? String(n.id) : '';
        })
        .filter(Boolean);

      // 3. Si hay costos, eliminar registros relacionados por costo_id
      if (costosIds.length > 0) {
        
        // Eliminar detalle_pedidos asociados por costo_id
        const { error: detalleCostoError } = await insforgeDb()
          .from('detalle_pedidos')
          .delete()
          .in('costo_id', costosIds);

        if (detalleCostoError) throw detalleCostoError;

        // Eliminar movimientos asociados
        const { error: movimientosError } = await insforgeDb()
          .from('movimientos')
          .delete()
          .in('costo_id', costosIds);

        if (movimientosError) throw movimientosError;
      }

      // 4. Eliminar los costos de la prenda
      if (costosIds.length > 0) {
        const { error: costosDelError } = await insforgeDb().from('costos').delete().in('id', costosIds);
        if (costosDelError) throw costosDelError;
      } else {
        let d = await insforgeDb().from('costos').delete().eq('prenda_id', id);
        if (d.error) d = await insforgeDb().from('costos').delete().eq('prendaId', id);
        if (d.error) throw d.error;
      }

      // 5. Finalmente eliminar la prenda
      const { error } = await insforgeDb()
        .from('prendas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchPrendas();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    prendas,
    loading,
    error,
    createPrenda,
    updatePrenda,
    deletePrenda,
    refetch: fetchPrendas,
  };
}


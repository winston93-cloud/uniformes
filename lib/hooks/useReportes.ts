'use client';

import { useState } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { compararTallas } from '../ordenTallas';
import { filtrarCostosInventarioTienda } from '@/lib/inventarioSucursal';
import { normalizarCamposCostoApi } from '@/lib/costoQueries';
import {
  esPrendaTenis,
  esPrendaRemateTenis,
  pedidoCoincideFiltroLinea,
  TENIS_PRENDA_ID,
  type FiltroLineaVenta,
} from '@/lib/winstonLineaVenta';

export interface ReporteVentas {
  id: string;
  folio: string;
  fecha: string;
  cliente: string;
  tipo_cliente: string;
  total: number;
}

export interface PrendaVendida {
  prenda: string;
  talla: string;
  cantidad: number;
  total: number;
}

export interface ClienteFrecuente {
  id: string;
  nombre: string;
  tipo: 'alumno' | 'externo';
  pedidos: number;
  total: number;
}

export interface ReporteGanancias {
  periodo: string;
  totalVentas: number;
  totalCostos: number;
  ganancia: number;
  margen: number;
  detalles: {
    prenda: string;
    talla: string;
    cantidad: number;
    ingresos: number;
    costos: number;
    ganancia: number;
  }[];
}

export type VentasAgrupadasFiltro =
  | { tipo: 'fechas'; fechaInicio: string; fechaFin: string }
  | { tipo: 'folios'; folioInicio: string; folioFin: string };

export type PrendaAgrupadaReporte = {
  prenda: string;
  detalles: {
    talla: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    folio?: string;
  }[];
  subtotal_cantidad: number;
  subtotal_monto: number;
};

/** Extrae prefijo + número de folios tipo wu0058, wt12, 5001. */
function parseFolioKey(folio: string): { prefix: string; num: number; raw: string } {
  const raw = folio.trim().toLowerCase();
  const m = raw.match(/^([a-z]*)(\d+)$/i);
  if (m) return { prefix: m[1], num: parseInt(m[2], 10), raw };
  const digits = raw.replace(/\D/g, '');
  return { prefix: '', num: digits ? parseInt(digits, 10) : Number.NaN, raw };
}

export function folioEnRangoNumerico(folio: string, inicio: string, fin: string): boolean {
  const f = parseFolioKey(folio);
  const a = parseFolioKey(inicio);
  const b = parseFolioKey(fin);
  if (!Number.isFinite(f.num) || !Number.isFinite(a.num) || !Number.isFinite(b.num)) {
    const fl = f.raw;
    const al = a.raw;
    const bl = b.raw;
    const lo = al <= bl ? al : bl;
    const hi = al <= bl ? bl : al;
    return fl >= lo && fl <= hi;
  }
  if (a.prefix && b.prefix && a.prefix === b.prefix && f.prefix !== a.prefix) {
    return false;
  }
  const lo = Math.min(a.num, b.num);
  const hi = Math.max(a.num, b.num);
  return f.num >= lo && f.num <= hi;
}

export function useReportes(
  sucursal_id?: string,
  es_matriz?: boolean,
  filtroLinea: FiltroLineaVenta = 'todos',
  gestiona_catalogo?: boolean
) {
  const [loading, setLoading] = useState(false);

  const sid = sucursal_id?.trim() || '';
  const inventarioOpts = {
    sucursalId: sid || undefined,
    esMatriz: es_matriz,
    incluirStockCero: gestiona_catalogo,
  };

  const filtrarCostosTienda = (rows: Record<string, unknown>[]) =>
    sid ? filtrarCostosInventarioTienda(rows, inventarioOpts) : rows;

  const filtrarPedidosLinea = (pedidos: Record<string, unknown>[]) => {
    if (filtroLinea === 'todos') return pedidos;
    return pedidos.filter((p) => pedidoCoincideFiltroLinea(p, filtroLinea));
  };

  const filtrarCostosPorLinea = (rows: Record<string, unknown>[]) => {
    if (filtroLinea === 'todos') return rows;
    return rows.filter((row) => {
      const r = row as Record<string, any>;
      const prendaId = String(r.prenda_id ?? r.prendaId ?? r.prenda?.id ?? '');
      const prendaNombre = r.prenda?.nombre as string | undefined;
      const esTenis = esPrendaTenis(prendaId, prendaNombre);
      const esRemate = esPrendaRemateTenis(prendaId, prendaNombre);
      if (filtroLinea === 'tenis') return esTenis;
      if (filtroLinea === 'remate_tenis') return esRemate;
      return !esTenis && !esRemate;
    });
  };

  const filtrarDetallesPorLinea = (detalles: any[]) => {
    if (filtroLinea === 'todos') return detalles;
    return detalles.filter((detalle) => {
      const prendaId = String(detalle.prenda_id ?? detalle.prenda?.id ?? '');
      const prendaNombre = detalle.prenda?.nombre as string | undefined;
      const esTenis = esPrendaTenis(prendaId, prendaNombre);
      const esRemate = esPrendaRemateTenis(prendaId, prendaNombre);
      if (filtroLinea === 'tenis') return esTenis;
      if (filtroLinea === 'remate_tenis') return esRemate;
      return !esTenis && !esRemate;
    });
  };

  const rangoLocalAIso = (fechaInicio: string, fechaFin: string) => {
    const [y1, m1, d1] = fechaInicio.split('-').map(Number);
    const [y2, m2, d2] = fechaFin.split('-').map(Number);
    const startLocal = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);
    const endLocal = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
    return { startLocal, endLocal, startIso: startLocal.toISOString(), endIso: endLocal.toISOString() };
  };

  const fechaEfectivaPedido = (pedido: Record<string, unknown>): Date | null => {
    const raw = pedido.created_at ?? pedido.updated_at;
    if (!raw) return null;
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const ventasPorPeriodo = async (fechaInicio: string, fechaFin: string): Promise<ReporteVentas[]> => {
    try {
      setLoading(true);
      const { startLocal, endLocal, startIso, endIso } = rangoLocalAIso(fechaInicio, fechaFin);

      // PENDIENTE + COMPLETADO (excluye cancelados). Sin columna `fecha` (eliminada en InsForge).
      let query = insforgeDb()
        .from('pedidos')
        .select(
          'id, created_at, updated_at, total, tipo_cliente, cliente_nombre, estado, sucursal_id, folio, linea_venta'
        )
        .in('estado', ['PENDIENTE', 'COMPLETADO'])
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true });

      if (sid) {
        query = query.eq('sucursal_id', sid);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo pedidos:', error);
        throw error;
      }

      const pedidosDetalle = filtrarPedidosLinea((data || []) as Record<string, unknown>[])
        .filter((pedido) => {
          const fechaPedido = fechaEfectivaPedido(pedido);
          if (!fechaPedido) return false;
          return fechaPedido >= startLocal && fechaPedido <= endLocal;
        })
        .map((pedido) => {
          const fechaPedido = fechaEfectivaPedido(pedido) ?? new Date();
          const folioRaw = String(pedido.folio ?? '').trim();
          return {
            id: String(pedido.id),
            folio: folioRaw || `#${String(pedido.id).substring(0, 8)}`,
            fecha: fechaPedido.toISOString(),
            cliente: String(pedido.cliente_nombre ?? 'Sin cliente'),
            tipo_cliente: String(pedido.tipo_cliente ?? ''),
            total: parseFloat(String(pedido.total ?? 0)),
          };
        });

      return pedidosDetalle;
    } catch (err: any) {
      console.error('Error en ventasPorPeriodo:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const prendasMasVendidas = async (fechaInicio?: string, fechaFin?: string): Promise<PrendaVendida[]> => {
    try {
      setLoading(true);
      let query = insforgeDb()
        .from('detalle_pedidos')
        .select(`
          cantidad,
          subtotal,
          prenda:prendas(nombre),
          talla:tallas(nombre)
        `)
        .order('cantidad', { ascending: false })
        .limit(20);

      if (fechaInicio && fechaFin) {
        const { startIso, endIso } = rangoLocalAIso(fechaInicio, fechaFin);
        let pedidosQuery = insforgeDb()
          .from('pedidos')
          .select('id')
          .in('estado', ['COMPLETADO'])
          .gte('created_at', startIso)
          .lte('created_at', endIso);
        if (sid) pedidosQuery = pedidosQuery.eq('sucursal_id', sid);
        const { data: pedidos } = await pedidosQuery;

        if (pedidos && pedidos.length > 0) {
          const pedidoIds = filtrarPedidosLinea(pedidos as Record<string, unknown>[]).map((p) =>
            String((p as { id: string }).id)
          );
          if (pedidoIds.length === 0) return [];
          query = query.in('pedido_id', pedidoIds);
        } else {
          return [];
        }
      } else if (sid) {
        const { data: pedidos } = await insforgeDb()
          .from('pedidos')
          .select('id')
          .in('estado', ['COMPLETADO'])
          .eq('sucursal_id', sid);
        if (pedidos?.length) {
          const pedidoIds = filtrarPedidosLinea(pedidos as Record<string, unknown>[]).map((p) =>
            String((p as { id: string }).id)
          );
          if (pedidoIds.length === 0) return [];
          query = query.in('pedido_id', pedidoIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por prenda y talla
      const agrupados = new Map<string, PrendaVendida>();

      data?.forEach((detalle: any) => {
        const prendaNombre = detalle.prenda?.nombre || 'Sin nombre';
        const tallaNombre = detalle.talla?.nombre || 'Sin talla';
        const key = `${prendaNombre}-${tallaNombre}`;

        const existente = agrupados.get(key) || {
          prenda: prendaNombre,
          talla: tallaNombre,
          cantidad: 0,
          total: 0,
        };

        agrupados.set(key, {
          prenda: prendaNombre,
          talla: tallaNombre,
          cantidad: existente.cantidad + detalle.cantidad,
          total: existente.total + parseFloat(detalle.subtotal.toString()),
        });
      });

      return Array.from(agrupados.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);
    } catch (err: any) {
      console.error('Error en prendasMasVendidas:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const stockBajo = async () => {
    try {
      setLoading(true);
      const { data: costosRaw, error } = await insforgeDb()
        .from('costos')
        .select(`
          *,
          prenda:prendas(nombre),
          talla:tallas(nombre)
        `)
        .eq('activo', true);

      if (error) throw error;

      const costosTienda = filtrarCostosTienda((costosRaw || []) as Record<string, unknown>[]);
      const stockBajoData = costosTienda.filter((costo) => Number(costo.stock ?? 0) <= 0);

      return stockBajoData;
    } catch (err: any) {
      console.error('Error en stockBajo:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const ordenarFilasInventario = (filas: any[]) => {
    filas.sort((a, b) => {
      const catA = a.categoriaNombre || '';
      const catB = b.categoriaNombre || '';
      const porCat = catA.localeCompare(catB, 'es', { sensitivity: 'base' });
      if (porCat !== 0) return porCat;
      const porPrenda = (a.prenda?.nombre || '').localeCompare(b.prenda?.nombre || '', 'es', {
        sensitivity: 'base',
      });
      if (porPrenda !== 0) return porPrenda;
      return compararTallas(a.talla, b.talla);
    });
    return filas;
  };

  /**
   * Inventario por categorías o prendas elegidas.
   * excluirStockCero: no incluye filas con stock existente = 0.
   */
  const estadoInventario = async (opts: {
    categoriaIds?: string[];
    incluirSinCategoria?: boolean;
    prendaIds?: string[];
    excluirStockCero?: boolean;
  }) => {
    try {
      setLoading(true);

      const categoriaIds = opts.categoriaIds ?? [];
      const incluirSinCategoria = opts.incluirSinCategoria ?? false;
      const prendaIdsDirectos = opts.prendaIds ?? [];
      const excluirStockCero = opts.excluirStockCero ?? false;

      const prendaIds = new Set<string>(prendaIdsDirectos.map(String));

      if (categoriaIds.length > 0) {
        const { data: prendasCat, error: errPrendas } = await insforgeDb()
          .from('prendas')
          .select('id')
          .in('categoria_id', categoriaIds);
        if (errPrendas) throw errPrendas;
        (prendasCat || []).forEach((p) => prendaIds.add(p.id));
      }

      if (incluirSinCategoria) {
        const { data: prendasSin, error: errSin } = await insforgeDb()
          .from('prendas')
          .select('id')
          .is('categoria_id', null);
        if (errSin) throw errSin;
        (prendasSin || []).forEach((p) => prendaIds.add(p.id));
      }

      if (prendaIds.size === 0) return [];

      const ids = Array.from(prendaIds);
      // Incluir sucursal_id: sin ella el filtro de tienda no aplica y el PDF mezcla matriz + Winston.
      let costosQuery = insforgeDb()
        .from('costos')
        .select(`
          id,
          sucursal_id,
          stock,
          stock_inicial,
          stock_minimo,
          prenda:prendas(nombre, categoria_id, categorias_prendas(id, nombre)),
          talla:tallas(nombre, orden)
        `)
        .eq('activo', true)
        .in('prenda_id', ids);
      if (sid) costosQuery = costosQuery.eq('sucursal_id', sid);

      const { data: costosRaw, error } = await costosQuery;

      if (error) throw error;

      let costosTienda = filtrarCostosTienda((costosRaw || []) as Record<string, unknown>[]);

      if (excluirStockCero) {
        costosTienda = costosTienda.filter((row) => {
          const actual = Number(row.stock);
          if (Number.isFinite(actual)) return actual > 0;
          const inicial = Number(row.stock_inicial);
          return Number.isFinite(inicial) ? inicial > 0 : false;
        });
      }

      // PostgREST puede truncar .in() muy grande; si hay muchos IDs, ya vienen por categoría/prenda.
      const filas = costosTienda.map((row) => {
        const r = row as Record<string, any>;
        const cat = r.prenda?.categorias_prendas;
        return {
          ...r,
          categoriaNombre: cat?.nombre || 'Sin categoría',
          categoriaId: r.prenda?.categoria_id ?? null,
        };
      });

      return ordenarFilasInventario(filas);
    } catch (err: any) {
      console.error('Error en estadoInventario:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const pedidosPendientes = async (): Promise<
    Array<{
      folio: string;
      cliente_nombre: string;
      created_at: string;
      total: number;
      prenda: string;
      cantidad_pendiente: number;
      talla: string;
      observacion: string;
    }>
  > => {
    try {
      setLoading(true);

      type Fila = {
        folio: string;
        cliente_nombre: string;
        created_at: string;
        total: number;
        prenda: string;
        cantidad_pendiente: number;
        talla: string;
        observacion: string;
      };

      let query = insforgeDb()
        .from('pedidos')
        .select(
          `
          id,
          folio,
          cliente_nombre,
          created_at,
          total,
          estado,
          linea_venta,
          detalle_pedidos (
            pendiente,
            especificaciones,
            precio_unitario,
            prenda_id,
            prenda:prendas ( nombre ),
            talla:tallas ( nombre )
          )
        `
        )
        .in('estado', ['PENDIENTE'])
        .order('created_at', { ascending: false });
      if (sid) query = query.eq('sucursal_id', sid);
      let { data, error } = await query;

      // Fallback sin embeds si el join falla
      if (error) {
        let q2 = insforgeDb()
          .from('pedidos')
          .select('id, folio, cliente_nombre, created_at, total, estado, linea_venta')
          .in('estado', ['PENDIENTE'])
          .order('created_at', { ascending: false });
        if (sid) q2 = q2.eq('sucursal_id', sid);
        const plain = await q2;
        if (plain.error) throw plain.error;
        data = [];
        for (const p of plain.data || []) {
          const det = await insforgeDb()
            .from('detalle_pedidos')
            .select('pendiente, especificaciones, precio_unitario, prenda_id, talla_id')
            .eq('pedido_id', p.id);
          const rows = (det.data || []) as Record<string, unknown>[];
          const prendaIds = [...new Set(rows.map((r) => String(r.prenda_id || '')).filter(Boolean))];
          const tallaIds = [...new Set(rows.map((r) => String(r.talla_id || '')).filter(Boolean))];
          const prendasMap = new Map<string, string>();
          const tallasMap = new Map<string, string>();
          if (prendaIds.length) {
            const { data: prs } = await insforgeDb().from('prendas').select('id, nombre').in('id', prendaIds);
            for (const pr of prs || []) prendasMap.set(String(pr.id), String(pr.nombre));
          }
          if (tallaIds.length) {
            const { data: ts } = await insforgeDb().from('tallas').select('id, nombre').in('id', tallaIds);
            for (const t of ts || []) tallasMap.set(String(t.id), String(t.nombre));
          }
          (data as any[]).push({
            ...p,
            detalle_pedidos: rows.map((r) => ({
              ...r,
              prenda: r.prenda_id ? { nombre: prendasMap.get(String(r.prenda_id)) } : null,
              talla: r.talla_id ? { nombre: tallasMap.get(String(r.talla_id)) } : null,
            })),
          });
        }
        error = null;
      }

      if (error) throw error;

      const pedidos = (data || []).filter((p) =>
        pedidoCoincideFiltroLinea(p as unknown as Record<string, unknown>, filtroLinea)
      );

      const filas: Fila[] = [];

      for (const p of pedidos as any[]) {
        const folio =
          (p.folio && String(p.folio).trim()) ||
          `#${String(p.id).substring(0, 8)}`;
        const detalles = Array.isArray(p.detalle_pedidos) ? p.detalle_pedidos : [];
        const pendientes = detalles.filter((d: Record<string, unknown>) => {
          const pend = Number(d.pendiente ?? 0);
          if (pend <= 0) return false;
          if (d.prenda_id == null || Number(d.precio_unitario) < 0) return false;
          return true;
        });

        const lineas =
          pendientes.length > 0
            ? pendientes
            : detalles.filter((d: Record<string, unknown>) => {
                if (d.prenda_id == null || Number(d.precio_unitario) < 0) return false;
                return true;
              });

        if (lineas.length === 0) {
          filas.push({
            folio,
            cliente_nombre: p.cliente_nombre || 'Sin cliente',
            created_at: p.created_at,
            total: Number(p.total) || 0,
            prenda: '—',
            cantidad_pendiente: 0,
            talla: '—',
            observacion: '—',
          });
          continue;
        }

        for (const d of lineas) {
          const prendaObj = d.prenda as { nombre?: string } | null;
          const tallaObj = d.talla as { nombre?: string } | null;
          const cantPend = Math.max(0, Math.round(Number(d.pendiente ?? 0)));
          filas.push({
            folio,
            cliente_nombre: p.cliente_nombre || 'Sin cliente',
            created_at: p.created_at,
            total: Number(p.total) || 0,
            prenda: prendaObj?.nombre || '—',
            cantidad_pendiente: cantPend,
            talla: tallaObj?.nombre || '—',
            observacion: String(d.especificaciones || '').trim() || '—',
          });
        }
      }

      return filas;
    } catch (err: any) {
      console.error('Error en pedidosPendientes:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const clientesFrecuentes = async (): Promise<ClienteFrecuente[]> => {
    try {
      setLoading(true);
      
      // Obtener pedidos liquidados con nombre del cliente
      let query = insforgeDb()
        .from('pedidos')
        .select('cliente_nombre, tipo_cliente, total')
        .in('estado', ['COMPLETADO']);
      if (sid) query = query.eq('sucursal_id', sid);
      const { data: pedidos, error } = await query;

      if (error) throw error;

      // Agrupar por nombre de cliente
      const agrupados = new Map<string, ClienteFrecuente>();
      
      for (const pedido of pedidos || []) {
        const nombreCliente = pedido.cliente_nombre || 'Sin cliente';
        
        const existente = agrupados.get(nombreCliente) || {
          id: nombreCliente,
          nombre: nombreCliente,
          tipo: pedido.tipo_cliente as 'alumno' | 'externo',
          pedidos: 0,
          total: 0,
        };

        agrupados.set(nombreCliente, {
          ...existente,
          pedidos: existente.pedidos + 1,
          total: existente.total + parseFloat(pedido.total.toString()),
        });
      }

      return Array.from(agrupados.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    } catch (err: any) {
      console.error('Error en clientesFrecuentes:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const resumenGeneral = async (fechaInicio?: string, fechaFin?: string) => {
    try {
      setLoading(true);

      const tienePeriodo = Boolean(fechaInicio?.trim() && fechaFin?.trim());
      const rango = tienePeriodo ? rangoLocalAIso(fechaInicio!.trim(), fechaFin!.trim()) : null;

      let pedidosQuery = insforgeDb()
        .from('pedidos')
        .select('id, folio, linea_venta, total, estado, created_at, updated_at')
        .in('estado', ['PENDIENTE', 'COMPLETADO']);
      if (sid) pedidosQuery = pedidosQuery.eq('sucursal_id', sid);
      if (rango) {
        pedidosQuery = pedidosQuery.gte('created_at', rango.startIso).lte('created_at', rango.endIso);
      }

      const [
        { data: pedidosRaw, error: errPedidos },
        { count: totalAlumnos },
        { data: costosRaw },
      ] = await Promise.all([
        pedidosQuery,
        fetch('/api/alumno/count')
          .then((r) => r.json())
          .then((j) => ({ count: j?.success ? Number(j.count) || 0 : 0 }))
          .catch(() => ({ count: 0 })),
        (() => {
          let q = insforgeDb().from('costos').select('stock, sucursal_id').eq('activo', true);
          if (sid) q = q.eq('sucursal_id', sid);
          return q;
        })(),
      ]);

      if (errPedidos) throw errPedidos;

      let pedidos = filtrarPedidosLinea((pedidosRaw || []) as Record<string, unknown>[]);
      if (rango) {
        pedidos = pedidos.filter((p) => {
          const f = fechaEfectivaPedido(p);
          return !!f && f >= rango.startLocal && f <= rango.endLocal;
        });
      }

      const costosTienda = filtrarCostosPorLinea(
        filtrarCostosTienda((costosRaw || []) as Record<string, unknown>[])
      );

      // Misma base que «Ventas por período»: PENDIENTE + COMPLETADO del rango.
      const ventasTotales = pedidos.reduce(
        (sum, p) => sum + parseFloat(String(p.total ?? 0)),
        0
      );

      return {
        totalPedidos: pedidos.length,
        ventasTotales,
        totalAlumnos: totalAlumnos || 0,
        prendasStock: costosTienda.reduce((sum, c) => sum + Number(c.stock ?? 0), 0),
      };
    } catch (err: any) {
      console.error('Error en resumenGeneral:', err);
      return {
        totalPedidos: 0,
        ventasTotales: 0,
        totalAlumnos: 0,
        prendasStock: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  const ingresosYGanancias = async (fechaInicio: string, fechaFin: string): Promise<ReporteGanancias | null> => {
    try {
      setLoading(true);
      
      const { startLocal, endLocal, startIso, endIso } = rangoLocalAIso(fechaInicio, fechaFin);

      let pedidosQuery = insforgeDb()
        .from('pedidos')
        .select('id, created_at, folio, linea_venta')
        .in('estado', ['COMPLETADO'])
        .gte('created_at', startIso)
        .lte('created_at', endIso);
      if (sid) pedidosQuery = pedidosQuery.eq('sucursal_id', sid);
      const { data: pedidos, error: pedidosError } = await pedidosQuery;

      if (pedidosError) throw pedidosError;

      const pedidosEnPeriodo =
        filtrarPedidosLinea((pedidos || []) as Record<string, unknown>[]).filter((pedido) => {
          const fechaPedido = fechaEfectivaPedido(pedido);
          if (!fechaPedido) return false;
          return fechaPedido >= startLocal && fechaPedido <= endLocal;
        }) || [];

      if (pedidosEnPeriodo.length === 0) {
        return {
          periodo: `${fechaInicio} al ${fechaFin}`,
          totalVentas: 0,
          totalCostos: 0,
          ganancia: 0,
          margen: 0,
          detalles: []
        };
      }

      const pedidoIds = pedidosEnPeriodo.map((p: any) => p.id);

      // Obtener detalles de pedidos
      const { data: detalles, error: detallesError } = await insforgeDb()
        .from('detalle_pedidos')
        .select(`
          cantidad,
          precio_unitario,
          subtotal,
          prenda_id,
          talla_id,
          prenda:prendas(nombre),
          talla:tallas(nombre)
        `)
        .in('pedido_id', pedidoIds);

      if (detallesError) throw detallesError;

      // Obtener precios de compra de costos
      let costosQuery = insforgeDb()
        .from('costos')
        .select('prenda_id, talla_id, precio_compra, precio_venta, sucursal_id');
      if (sid) costosQuery = costosQuery.eq('sucursal_id', sid);
      const { data: costos, error: costosError } = await costosQuery;

      if (costosError) throw costosError;

      const costosMap = new Map(
        (costos || []).map((c: Record<string, unknown>) => {
          const n = normalizarCamposCostoApi(c);
          return [`${n.prenda_id}-${n.talla_id}`, n];
        })
      );

      // Calcular por prenda
      const detallesPorPrenda = new Map<string, any>();
      let totalVentas = 0;
      let totalCostos = 0;

      detalles?.forEach((detalle: any) => {
        const key = `${detalle.prenda_id}-${detalle.talla_id}`;
        const costo = costosMap.get(key);
        const prendaNombre = detalle.prenda?.nombre || 'Sin nombre';
        const tallaNombre = detalle.talla?.nombre || 'Sin talla';
        const keyPrenda = `${prendaNombre}-${tallaNombre}`;

        const ingresos = detalle.subtotal;
        const costoTotal = Number(costo?.precio_compra ?? 0) * detalle.cantidad;

        totalVentas += ingresos;
        totalCostos += costoTotal;

        const existente = detallesPorPrenda.get(keyPrenda) || {
          prenda: prendaNombre,
          talla: tallaNombre,
          cantidad: 0,
          ingresos: 0,
          costos: 0,
          ganancia: 0
        };

        detallesPorPrenda.set(keyPrenda, {
          prenda: prendaNombre,
          talla: tallaNombre,
          cantidad: existente.cantidad + detalle.cantidad,
          ingresos: existente.ingresos + ingresos,
          costos: existente.costos + costoTotal,
          ganancia: existente.ganancia + (ingresos - costoTotal)
        });
      });

      const ganancia = totalVentas - totalCostos;
      const margen = totalVentas > 0 ? (ganancia / totalVentas) * 100 : 0;

      return {
        periodo: `${fechaInicio} al ${fechaFin}`,
        totalVentas,
        totalCostos,
        ganancia,
        margen,
        detalles: Array.from(detallesPorPrenda.values())
          .sort((a, b) => b.ganancia - a.ganancia)
      };
    } catch (err: any) {
      console.error('Error en ingresosYGanancias:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const ventasAgrupadas = async (
    filtro: VentasAgrupadasFiltro
  ): Promise<PrendaAgrupadaReporte[]> => {
    try {
      setLoading(true);

      let pedidosQuery = insforgeDb()
        .from('pedidos')
        .select('id, folio, created_at, updated_at, estado, linea_venta, sucursal_id')
        .in('estado', ['PENDIENTE', 'COMPLETADO']);
      if (sid) pedidosQuery = pedidosQuery.eq('sucursal_id', sid);

      if (filtro.tipo === 'fechas') {
        const { startIso, endIso } = rangoLocalAIso(filtro.fechaInicio, filtro.fechaFin);
        pedidosQuery = pedidosQuery.gte('created_at', startIso).lte('created_at', endIso);
      }

      const { data: pedidosRaw, error: errPedidos } = await pedidosQuery;
      if (errPedidos) throw errPedidos;

      let pedidos = filtrarPedidosLinea((pedidosRaw || []) as Record<string, unknown>[]);

      if (filtro.tipo === 'fechas') {
        const { startLocal, endLocal } = rangoLocalAIso(filtro.fechaInicio, filtro.fechaFin);
        pedidos = pedidos.filter((p) => {
          const f = fechaEfectivaPedido(p);
          return !!f && f >= startLocal && f <= endLocal;
        });
      } else {
        pedidos = pedidos.filter((p) => {
          const folio = String(p.folio ?? '').trim();
          if (!folio) return false;
          return folioEnRangoNumerico(folio, filtro.folioInicio, filtro.folioFin);
        });
      }

      if (pedidos.length === 0) return [];

      const pedidoMeta = new Map<string, { folio: string }>();
      for (const p of pedidos) {
        pedidoMeta.set(String(p.id), {
          folio: String(p.folio ?? '').trim() || `#${String(p.id).substring(0, 8)}`,
        });
      }
      const pedidoIds = [...pedidoMeta.keys()];

      type DetalleRow = {
        pedido_id: string;
        cantidad: number;
        precio_unitario: number;
        subtotal: number;
        prenda_id?: string | null;
        prenda?: { nombre?: string } | null;
        talla?: { nombre?: string } | null;
      };

      const detalles: DetalleRow[] = [];
      const chunkSize = 80;
      for (let i = 0; i < pedidoIds.length; i += chunkSize) {
        const chunk = pedidoIds.slice(i, i + chunkSize);
        const { data, error } = await insforgeDb()
          .from('detalle_pedidos')
          .select(
            `
            pedido_id,
            cantidad,
            precio_unitario,
            subtotal,
            prenda_id,
            prenda:prendas ( nombre ),
            talla:tallas ( nombre )
          `
          )
          .in('pedido_id', chunk);
        if (error) throw error;
        for (const row of data || []) detalles.push(row as DetalleRow);
      }

      type Agg = {
        prenda: string;
        talla: string;
        cantidad: number;
        precio_unitario: number;
        subtotal: number;
        folio?: string;
      };

      const mapa = new Map<string, Agg>();

      for (const d of detalles) {
        if (d.prenda_id == null || Number(d.precio_unitario) < 0) continue;
        const cant = Math.max(0, Math.round(Number(d.cantidad ?? 0)));
        if (cant <= 0) continue;
        const prenda = String(d.prenda?.nombre ?? 'Sin nombre').trim() || 'Sin nombre';
        const talla = String(d.talla?.nombre ?? '—').trim() || '—';
        const precio = parseFloat(String(d.precio_unitario ?? 0)) || 0;
        const sub =
          Number.isFinite(Number(d.subtotal)) && Number(d.subtotal) > 0
            ? parseFloat(String(d.subtotal))
            : cant * precio;
        const meta = pedidoMeta.get(String(d.pedido_id));
        const folio = meta?.folio;

        const key =
          filtro.tipo === 'folios'
            ? `${prenda}||${talla}||${precio}||${folio ?? ''}`
            : `${prenda}||${talla}||${precio}`;

        const prev = mapa.get(key);
        if (prev) {
          prev.cantidad += cant;
          prev.subtotal += sub;
        } else {
          mapa.set(key, {
            prenda,
            talla,
            cantidad: cant,
            precio_unitario: precio,
            subtotal: sub,
            folio: filtro.tipo === 'folios' ? folio : undefined,
          });
        }
      }

      const porPrenda = new Map<string, PrendaAgrupadaReporte>();
      for (const row of mapa.values()) {
        const g =
          porPrenda.get(row.prenda) ||
          ({
            prenda: row.prenda,
            detalles: [],
            subtotal_cantidad: 0,
            subtotal_monto: 0,
          } satisfies PrendaAgrupadaReporte);
        g.detalles.push({
          talla: row.talla,
          cantidad: row.cantidad,
          precio_unitario: row.precio_unitario,
          subtotal: row.subtotal,
          folio: row.folio,
        });
        g.subtotal_cantidad += row.cantidad;
        g.subtotal_monto += row.subtotal;
        porPrenda.set(row.prenda, g);
      }

      const resultado = Array.from(porPrenda.values())
        .map((g) => ({
          ...g,
          detalles: g.detalles.sort((a, b) =>
            a.talla.localeCompare(b.talla, 'es', { numeric: true, sensitivity: 'base' })
          ),
        }))
        .sort((a, b) => a.prenda.localeCompare(b.prenda, 'es', { sensitivity: 'base' }));

      return resultado;
    } catch (err: any) {
      console.error('Error en ventasAgrupadas:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    ventasPorPeriodo,
    prendasMasVendidas,
    stockBajo,
    estadoInventario,
    pedidosPendientes,
    clientesFrecuentes,
    resumenGeneral,
    ingresosYGanancias,
    ventasAgrupadas,
  };
}


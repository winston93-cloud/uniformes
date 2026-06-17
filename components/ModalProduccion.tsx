'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Check, FileText, Pencil, FileDown } from 'lucide-react';
import { useCotizaciones } from '@/lib/hooks/useCotizaciones';
import { supabase } from '@/lib/supabase';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Cotizacion, DetalleCotizacion, Costo } from '@/lib/types';
import {
  compareCotizacionesPorFechaEntrega,
  compareItemsProduccionPorFechaEntrega,
} from '@/lib/cotizacionesSort';
import {
  cotizacionPrioritariaParaPlan,
  finVentanaPrioridadPlan,
  getWeekForDate,
} from '@/lib/produccion-semanal-week';
import {
  abrirPlanTrabajoSemanalPdf,
  type FilaPlanTrabajoPdf,
} from '@/lib/plan-trabajo-semanal-pdf';
import { obtenerDiagnosticoRecetaPrendaTalla } from '@/lib/costo-bruto-prenda';

/** Fila guardada en InsForge para esta semana (permite conservar partidas sin reexpandir cotizaciones). */
type PlanItemSemana = {
  detalle_id: string;
  cotizacion_id: string;
  cotizacion_folio: string;
  modelo: string;
  piezas: number;
  precio_unitario: number;
  costo_unitario: number;
};

type SeleccionRow = {
  cotizacion_id: string;
  cotizacion_folio: string;
  detalle_id: string;
  modelo: string;
  piezas: number;
  precio_unitario: number;
  costo_unitario: number;
  ganancia_unitaria: number;
  ganancia_total: number;
  advertencia_insumos?: 'SIN_INSUMOS' | 'INSUMO_SIN_COSTO';
};

/** Costo bruto por receta (insumos); si aún no cargó, respaldo `precio_compra` del costo. */
function costoBrutoEfectivoUnitario(
  costoId: string | undefined,
  costoBrutoPorCostoId: Record<string, number>,
  costoPorId: Record<string, Costo>
): number {
  if (!costoId) return 0;
  const row = costoPorId[costoId];
  if (!row) return 0;
  if (costoBrutoPorCostoId[costoId] !== undefined) {
    return costoBrutoPorCostoId[costoId];
  }
  return Number((row as Costo).precio_compra) || 0;
}

function rowDesdePlanItemGuardado(
  p: PlanItemSemana,
  piezasArg: number,
  costoId: string | undefined,
  costoBrutoPorCostoId: Record<string, number>,
  costoPorId: Record<string, Costo>
): SeleccionRow {
  const precio = Number(p.precio_unitario) || 0;
  let costo = costoBrutoEfectivoUnitario(costoId, costoBrutoPorCostoId, costoPorId);
  if (!costoId) {
    costo = Number(p.costo_unitario) || 0;
  }
  const piezas = Number(piezasArg) || 0;
  const ganU = Number((precio - costo).toFixed(2));
  const ganT = Number((ganU * piezas).toFixed(2));
  return {
    cotizacion_id: p.cotizacion_id,
    cotizacion_folio: p.cotizacion_folio,
    detalle_id: p.detalle_id,
    modelo: p.modelo,
    piezas,
    precio_unitario: precio,
    costo_unitario: costo,
    ganancia_unitaria: ganU,
    ganancia_total: ganT,
  };
}

export interface ItemProduccion {
  cotizacion_id: string;
  folio: string;
  detalle_id: string;
  modelo: string;
  piezas: number;
  /** Para ordenar listados del módulo por la misma fecha que la cotización */
  fecha_entrega?: string | null;
}

interface ModalProduccionProps {
  onClose: () => void;
  onGuardar: (items: ItemProduccion[]) => void;
}

function formatWeekRange(monday: Date, sunday: Date) {
  return `${monday.getDate()} - ${sunday.getDate()} ${sunday.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`;
}

function fmtFechaCot(fecha: string | null | undefined) {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-MX');
  } catch {
    return '—';
  }
}

function fmtMxn(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Máximo de piezas que pueden planearse en la semana vista (restante tras otras semanas). */
function maxPiezasEstaSemana(
  detalleId: string,
  cantidadLinea: number,
  piezasEnOtrasSemanas: Record<string, number>
): number {
  const o = piezasEnOtrasSemanas[detalleId] ?? 0;
  return Math.max(0, Math.floor(Number(cantidadLinea) || 0) - o);
}

function detalleTieneCupoOPiezasEnEstaSemana(
  d: DetalleCotizacion,
  piezasEnOtrasSemanas: Record<string, number>,
  piezasEstaSemana: Record<string, number>
): boolean {
  const maxAqui = maxPiezasEstaSemana(d.id, d.cantidad, piezasEnOtrasSemanas);
  const ya = piezasEstaSemana[d.id] ?? 0;
  return maxAqui > 0 || ya > 0;
}

/** Al menos una partida con piezas libres o ya asignadas a esta semana. */
function cotizacionTienePartidaDisponibleAqui(
  detalles: DetalleCotizacion[] | undefined,
  piezasEnOtrasSemanas: Record<string, number>,
  piezasEstaSemana: Record<string, number>
): boolean {
  if (!detalles || detalles.length === 0) return false;
  return detalles.some((d) => detalleTieneCupoOPiezasEnEstaSemana(d, piezasEnOtrasSemanas, piezasEstaSemana));
}

/** Cada partida de cotizaciones prioritarias tiene asignadas (esta u otras semanas) todas las piezas del pedido. */
function todasPartidasPrioridadPlaneadas(
  cotizacionesPrioritarias: Cotizacion[],
  detallesExpandidos: Record<string, DetalleCotizacion[]>,
  piezasPorDetalle: Record<string, number>,
  piezasEnOtrasSemanas: Record<string, number>
): boolean {
  for (const cot of cotizacionesPrioritarias) {
    const detalles = detallesExpandidos[cot.id];
    if (detalles === undefined) return false;
    for (const d of detalles) {
      const cant = Math.max(0, Math.floor(Number(d.cantidad) || 0));
      const asign =
        (piezasPorDetalle[d.id] ?? 0) + (piezasEnOtrasSemanas[d.id] ?? 0);
      if (asign < cant) return false;
    }
  }
  return true;
}

export default function ModalProduccion({ onClose, onGuardar }: ModalProduccionProps) {
  const [mounted, setMounted] = useState(false);
  const [modalPartidasAbierto, setModalPartidasAbierto] = useState(false);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [cotizacionExpandida, setCotizacionExpandida] = useState<string | null>(null);
  const [detallesExpandidos, setDetallesExpandidos] = useState<Record<string, DetalleCotizacion[]>>({});
  const [costoPorId, setCostoPorId] = useState<Record<string, Costo>>({});
  /** costo_id → costo bruto por prenda (receta insumos × costo unitario por presentación). */
  const [costoBrutoPorCostoId, setCostoBrutoPorCostoId] = useState<Record<string, number>>({});
  /** costo_id → advertencia de insumos (sin receta / insumo sin costo). */
  const [advertenciaInsumosPorCostoId, setAdvertenciaInsumosPorCostoId] = useState<
    Record<string, 'SIN_INSUMOS' | 'INSUMO_SIN_COSTO'>
  >({});
  /** detalle_id → costo_id cuando la partida no está en detalles expandidos (p. ej. solo en plan guardado). */
  const [detalleCostoIdExtra, setDetalleCostoIdExtra] = useState<Record<string, string>>({});
  const [loadingCostoBruto, setLoadingCostoBruto] = useState(false);
  /** detalle_id → piezas asignadas al plan de la semana que se edita (0 = no entra en el plan). */
  const [piezasPorDetalle, setPiezasPorDetalle] = useState<Record<string, number>>({});
  const [gastosFijosTotal, setGastosFijosTotal] = useState(0);
  const [loadingGastos, setLoadingGastos] = useState(false);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Tras generar plan: datos para mensaje en UI y PDF (sin alert). */
  const [planGeneradoPdf, setPlanGeneradoPdf] = useState<null | {
    tituloSemana: string;
    filas: FilaPlanTrabajoPdf[];
    gastosFijos: number;
    gananciasTotal: number;
  }>(null);
  const [seleccionGuardadaMsg, setSeleccionGuardadaMsg] = useState<string | null>(null);
  /** Piezas ya comprometidas en planes de otras semanas (por detalle_id). */
  const [piezasEnOtrasSemanas, setPiezasEnOtrasSemanas] = useState<Record<string, number>>({});
  const [loadingContext, setLoadingContext] = useState(false);
  const [guardandoSeleccion, setGuardandoSeleccion] = useState(false);
  /** Ítems ya persistidos en esta semana (evita perder partidas al guardar solo lo expandido). */
  const [planItemsCache, setPlanItemsCache] = useState<PlanItemSemana[]>([]);
  const prefetchedCotIdsRef = useRef<Set<string>>(new Set());

  const { cotizaciones, obtenerCotizacion } = useCotizaciones();

  const { monday, sunday } = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + semanaOffset * 7);
    return getWeekForDate(base);
  }, [semanaOffset]);

  /** Solo aprobadas: el plan semanal no incluye cotizaciones ya terminadas. */
  const cotizacionesProduccion = useMemo(() => {
    return [...cotizaciones.filter((c) => c.estado === 'aprobado')].sort(
      compareCotizacionesPorFechaEntrega
    );
  }, [cotizaciones]);

  const cotizacionesIdsKey = useMemo(
    () => cotizacionesProduccion.map((c) => c.id).sort().join(','),
    [cotizacionesProduccion]
  );

  /** Oculta cotizaciones cuyas partidas están todas en otra semana (no aplica hasta cargar detalles). */
  const cotizacionesVisibles = useMemo(() => {
    if (loadingContext) return cotizacionesProduccion;
    return cotizacionesProduccion.filter((cot) => {
      const detalles = detallesExpandidos[cot.id];
      if (!detalles) return true;
      return cotizacionTienePartidaDisponibleAqui(detalles, piezasEnOtrasSemanas, piezasPorDetalle);
    });
  }, [
    cotizacionesProduccion,
    detallesExpandidos,
    piezasEnOtrasSemanas,
    piezasPorDetalle,
    loadingContext,
  ]);

  const nombreCliente = (cot: Cotizacion) =>
    cot.alumno?.nombre || cot.externo?.nombre || 'Cliente general';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      setLoadingContext(true);
      try {
        const res = await fetch(`/api/produccion-semanal/context?semanaOffset=${semanaOffset}`);
        const json = await res.json().catch(() => null);
        if (cancelled || !json?.success) return;
        const otras = (json.piezasEnOtrasSemanas as Record<string, number> | undefined) || {};
        setPiezasEnOtrasSemanas(otras);
        const rawItems = (json.planItems as PlanItemSemana[] | undefined) || [];
        setPlanItemsCache(rawItems);
        const nextPiezas: Record<string, number> = {};
        for (const x of rawItems) {
          const n = Number(x.piezas) || 0;
          if (n > 0) nextPiezas[x.detalle_id] = n;
        }
        setPiezasPorDetalle(nextPiezas);
      } catch {
        if (!cancelled) setPiezasEnOtrasSemanas({});
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, semanaOffset]);

  useEffect(() => {
    if (cotizacionExpandida && !cotizacionesVisibles.some((c) => c.id === cotizacionExpandida)) {
      setCotizacionExpandida(null);
    }
  }, [cotizacionesVisibles, cotizacionExpandida]);

  const handleClosePrincipal = () => {
    setModalPartidasAbierto(false);
    setPlanGeneradoPdf(null);
    onClose();
  };

  useEffect(() => {
    setPlanGeneradoPdf(null);
  }, [semanaOffset]);

  /** Precarga partidas al abrir el modal de partidas (filtra cotizaciones sin partidas en esta semana). */
  useEffect(() => {
    if (!mounted || !modalPartidasAbierto || !cotizacionesIdsKey) return;
    let cancelled = false;
    (async () => {
      await Promise.all(
        cotizacionesProduccion.map(async (c) => {
          if (prefetchedCotIdsRef.current.has(c.id)) return;
          prefetchedCotIdsRef.current.add(c.id);
          try {
            const { detalle } = await obtenerCotizacion(c.id);
            if (cancelled) return;
            const list = detalle ?? [];
            setDetallesExpandidos((prev) => (prev[c.id] ? prev : { ...prev, [c.id]: list }));
            const costoIds = Array.from(
              new Set(
                (list as any[]).map((d) => d.costo_id).filter((x) => typeof x === 'string' && x.length > 0)
              )
            ) as string[];
            if (costoIds.length === 0) return;
            const { data: costosRows, error: costosErr } = await insforgeDb()
              .from('costos')
              .select('*')
              .in('id', costoIds);
            if (!costosErr && costosRows) {
              setCostoPorId((prev) => {
                const next = { ...prev };
                for (const row of costosRows as any[]) next[row.id] = row as Costo;
                return next;
              });
            }
          } catch (e) {
            console.error('Prefetch cotización', c.id, e);
            prefetchedCotIdsRef.current.delete(c.id);
          }
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, modalPartidasAbierto, cotizacionesIdsKey, cotizacionesProduccion, obtenerCotizacion]);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      setLoadingGastos(true);
      try {
        const res = await fetch('/api/gastos-fijos-semanales/actual');
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudieron cargar gastos fijos');
        const total = (json.gastosGuardados ?? []).reduce((sum: number, g: any) => sum + (Number(g.monto) || 0), 0);
        setGastosFijosTotal(total);
      } catch (e) {
        setGastosFijosTotal(0);
      } finally {
        setLoadingGastos(false);
      }
    })();
  }, [mounted]);

  const handleExpandirCotizacion = async (id: string) => {
    if (cotizacionExpandida === id) {
      setCotizacionExpandida(null);
      return;
    }
    setCotizacionExpandida(id);
    if (!detallesExpandidos[id]) {
      try {
        const { detalle } = await obtenerCotizacion(id);
        setDetallesExpandidos((prev) => ({ ...prev, [id]: detalle }));

        const costoIds = Array.from(
          new Set(
            (detalle as any[])
              .map((d) => d.costo_id)
              .filter((x) => typeof x === 'string' && x.length > 0)
          )
        ) as string[];

        if (costoIds.length > 0) {
          const faltantes = costoIds.filter((cid) => !costoPorId[cid]);
          if (faltantes.length > 0) {
            const { data: costosRows, error: costosErr } = await insforgeDb()
              .from('costos')
              .select('*')
              .in('id', faltantes);
            if (!costosErr && costosRows) {
              setCostoPorId((prev) => {
                const next = { ...prev };
                for (const c of costosRows as any[]) next[c.id] = c as Costo;
                return next;
              });
            }
          }
        }
      } catch (e) {
        console.error('Error cargando detalle:', e);
      }
    }
  };

  const detalleExpandidoPorId = useMemo(() => {
    const m = new Map<string, { detalle: DetalleCotizacion; cot: Cotizacion }>();
    for (const cot of cotizacionesProduccion) {
      for (const d of detallesExpandidos[cot.id] || []) {
        m.set(d.id, { detalle: d, cot });
      }
    }
    return m;
  }, [cotizacionesProduccion, detallesExpandidos]);

  const detalleIdACostoId = useMemo(() => {
    const r: Record<string, string> = { ...detalleCostoIdExtra };
    for (const cot of cotizacionesProduccion) {
      for (const d of detallesExpandidos[cot.id] || []) {
        if (d.costo_id) r[d.id] = d.costo_id as string;
      }
    }
    return r;
  }, [cotizacionesProduccion, detallesExpandidos, detalleCostoIdExtra]);

  /** Partidas en el plan sin detalle en memoria: obtener costo_id y filas de costos para el costo bruto. */
  useEffect(() => {
    const ids = Object.keys(piezasPorDetalle).filter((detalleId) => !detalleExpandidoPorId.has(detalleId));
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('detalle_cotizacion').select('id, costo_id').in('id', ids);
      if (cancelled || error || !data?.length) return;
      const ext: Record<string, string> = {};
      const costoIds: string[] = [];
      for (const row of data as { id: string; costo_id?: string | null }[]) {
        if (row.costo_id) {
          ext[row.id] = row.costo_id;
          costoIds.push(row.costo_id);
        }
      }
      if (Object.keys(ext).length > 0) {
        setDetalleCostoIdExtra((prev) => ({ ...prev, ...ext }));
      }
      if (costoIds.length === 0) return;
      const uniq = [...new Set(costoIds)];
      const { data: costosRows, error: costosErr } = await insforgeDb().from('costos').select('*').in('id', uniq);
      if (cancelled || costosErr || !costosRows?.length) return;
      setCostoPorId((prev) => {
        const n = { ...prev };
        for (const row of costosRows as Costo[]) n[row.id] = row;
        return n;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [piezasPorDetalle, detalleExpandidoPorId]);

  useEffect(() => {
    const costoIds = Object.keys(costoPorId);
  if (costoIds.length === 0) {
    setCostoBrutoPorCostoId({});
    setAdvertenciaInsumosPorCostoId({});
    setLoadingCostoBruto(false);
    return;
  }
    let cancelled = false;
    setLoadingCostoBruto(true);
    (async () => {
      const next: Record<string, number> = {};
      const warn: Record<string, 'SIN_INSUMOS' | 'INSUMO_SIN_COSTO'> = {};
      await Promise.all(
        costoIds.map(async (cid) => {
          const c = costoPorId[cid];
          if (!c?.prenda_id || !c?.talla_id) {
            next[cid] = Number(c.precio_compra) || 0;
            return;
          }
          const diag = await obtenerDiagnosticoRecetaPrendaTalla(insforgeDb(), c.prenda_id, c.talla_id);
          if (diag.ok) {
            next[cid] = diag.costo_bruto_unitario;
          } else {
            // Sin receta / insumo sin costo: marcamos advertencia y NO usamos fallback para cálculo.
            warn[cid] = diag.motivo;
            next[cid] = 0;
          }
        })
      );
      if (!cancelled) {
        setCostoBrutoPorCostoId(next);
        setAdvertenciaInsumosPorCostoId(warn);
      }
      if (!cancelled) {
        setLoadingCostoBruto(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [costoPorId]);

  const seleccionInfo = useMemo(() => {
    const rows: SeleccionRow[] = [];

    for (const detalleId of Object.keys(piezasPorDetalle)) {
      const piezas = piezasPorDetalle[detalleId];
      if (!piezas || piezas <= 0) continue;

      const hit = detalleExpandidoPorId.get(detalleId);
      if (hit) {
        const d = hit.detalle as any;
        const cot = hit.cot;
        const precio = Number(d.precio_unitario) || 0;
        const costoId = d.costo_id as string | undefined;
        const advertencia = costoId ? advertenciaInsumosPorCostoId[costoId] : undefined;
        const costoUnit = costoBrutoEfectivoUnitario(costoId, costoBrutoPorCostoId, costoPorId);
        const ganU = advertencia ? 0 : Number((precio - costoUnit).toFixed(2));
        const ganT = advertencia ? 0 : Number((ganU * piezas).toFixed(2));
        rows.push({
          cotizacion_id: cot.id,
          cotizacion_folio: cot.folio,
          detalle_id: d.id,
          modelo: d.prenda_nombre,
          piezas,
          precio_unitario: precio,
          costo_unitario: costoUnit,
          ganancia_unitaria: ganU,
          ganancia_total: ganT,
          advertencia_insumos: advertencia,
        });
        continue;
      }

      const cached = planItemsCache.find((p) => p.detalle_id === detalleId);
      if (cached) {
        const costoIdPlan = detalleIdACostoId[detalleId];
        const advertencia = costoIdPlan ? advertenciaInsumosPorCostoId[costoIdPlan] : undefined;
        const row = rowDesdePlanItemGuardado(
          { ...cached, piezas },
          piezas,
          costoIdPlan,
          costoBrutoPorCostoId,
          costoPorId
        );
        if (advertencia) {
          row.ganancia_unitaria = 0;
          row.ganancia_total = 0;
          row.advertencia_insumos = advertencia;
        }
        rows.push(row);
      }
    }

    const gananciasTotal = rows.reduce((s, r) => s + r.ganancia_total, 0);
    return { rows, gananciasTotal };
  }, [
    piezasPorDetalle,
    detalleExpandidoPorId,
    costoPorId,
    costoBrutoPorCostoId,
    advertenciaInsumosPorCostoId,
    planItemsCache,
    detalleIdACostoId,
  ]);

  const partidasConAdvertencia = useMemo(
    () => seleccionInfo.rows.filter((r) => Boolean(r.advertencia_insumos)),
    [seleccionInfo.rows]
  );

  const hayCotizacionPosterior = useMemo(
    () =>
      cotizacionesProduccion.some((c) => !cotizacionPrioritariaParaPlan(c.fecha_entrega, monday)),
    [cotizacionesProduccion, monday]
  );

  const hayCotizacionPrioridad = useMemo(
    () =>
      cotizacionesProduccion.some((c) => cotizacionPrioritariaParaPlan(c.fecha_entrega, monday)),
    [cotizacionesProduccion, monday]
  );

  const cotizacionesPrioritarias = useMemo(
    () =>
      cotizacionesProduccion.filter((c) => cotizacionPrioritariaParaPlan(c.fecha_entrega, monday)),
    [cotizacionesProduccion, monday]
  );

  /** Todas las partidas de cotizaciones con entrega en la semana del plan o la siguiente deben estar totalmente planeadas (suma en todas las semanas = pedido). */
  const reglaPrioridadSemanasCumplida = useMemo(() => {
    if (!hayCotizacionPosterior) return true;
    if (!hayCotizacionPrioridad) return true;
    return todasPartidasPrioridadPlaneadas(
      cotizacionesPrioritarias,
      detallesExpandidos,
      piezasPorDetalle,
      piezasEnOtrasSemanas
    );
  }, [
    hayCotizacionPosterior,
    hayCotizacionPrioridad,
    cotizacionesPrioritarias,
    detallesExpandidos,
    piezasPorDetalle,
    piezasEnOtrasSemanas,
  ]);

  /** Hay piezas en cotizaciones “posteriores” sin haber cumplido la regla de prioridad. */
  const seleccionInvalidaSinPrioridad = useMemo(() => {
    if (reglaPrioridadSemanasCumplida) return false;
    const cotPorId = new Map(cotizacionesProduccion.map((c) => [c.id, c] as const));
    return seleccionInfo.rows.some((r) => {
      const cot = cotPorId.get(r.cotizacion_id);
      return cot && !cotizacionPrioritariaParaPlan(cot.fecha_entrega, monday);
    });
  }, [reglaPrioridadSemanasCumplida, seleccionInfo.rows, cotizacionesProduccion, monday]);

  const fechaFinVentanaPrioridadFmt = useMemo(
    () => finVentanaPrioridadPlan(monday).toLocaleDateString('es-MX'),
    [monday]
  );

  const setPiezasLinea = useCallback(
    (cot: Cotizacion, detalle: DetalleCotizacion, raw: number) => {
      if (
        !reglaPrioridadSemanasCumplida &&
        !cotizacionPrioritariaParaPlan(cot.fecha_entrega, monday)
      ) {
        return;
      }
      const maxAqui = maxPiezasEstaSemana(detalle.id, detalle.cantidad, piezasEnOtrasSemanas);
      const v = Math.max(0, Math.min(maxAqui, Math.round(Number(raw) || 0)));
      setPiezasPorDetalle((prev) => {
        const next = { ...prev };
        if (v <= 0) delete next[detalle.id];
        else next[detalle.id] = v;
        return next;
      });
    },
    [reglaPrioridadSemanasCumplida, monday, piezasEnOtrasSemanas]
  );

  /** Filas para la tabla del modal principal (mismas columnas que al elegir partidas). */
  const filasResumenSemana = useMemo(() => {
    const porId = new Map(cotizaciones.map((c) => [c.id, c] as const));
    return seleccionInfo.rows.map((r) => {
      const cot = porId.get(r.cotizacion_id);
      return {
        key: r.detalle_id,
        cotizacion: r.cotizacion_folio,
        cliente: cot ? nombreCliente(cot) : '—',
        modelo: r.modelo,
        piezas: r.piezas,
        fechaEntrega: cot?.fecha_entrega,
      };
    });
  }, [seleccionInfo.rows, cotizaciones]);

  /** Mínimo: suma de ganancias de todas las prendas/partidas seleccionadas vs gastos fijos semanales. */
  const minimoAlcanzado = seleccionInfo.gananciasTotal >= gastosFijosTotal && gastosFijosTotal > 0;

  /** Monto que falta para que esa ganancia total cubra los gastos fijos de la semana. */
  const faltanteGastosSemanales =
    gastosFijosTotal > 0 ? Math.max(0, gastosFijosTotal - seleccionInfo.gananciasTotal) : 0;

  /** 0–100 % del mínimo (gastos fijos); solo para barra y etiqueta, sin mostrar pesos. */
  const progresoPct =
    gastosFijosTotal > 0
      ? Math.min(100, (seleccionInfo.gananciasTotal / gastosFijosTotal) * 100)
      : 0;

  /** Utilidad neta semanal: ganancias brutas (selección) − gastos fijos. */
  const utilidadNetaSemana = useMemo(() => {
    if (gastosFijosTotal <= 0) return 0;
    return Number((seleccionInfo.gananciasTotal - gastosFijosTotal).toFixed(2));
  }, [seleccionInfo.gananciasTotal, gastosFijosTotal]);

  const cargandoValidacion = loadingGastos || loadingCostoBruto;

  const handleGuardar = () => {
    const porCot = new Map(cotizacionesProduccion.map((c) => [c.id, c] as const));
    const items: ItemProduccion[] = seleccionInfo.rows.map((r) => {
      const cot = porCot.get(r.cotizacion_id);
      return {
        cotizacion_id: r.cotizacion_id,
        folio: r.cotizacion_folio,
        detalle_id: r.detalle_id,
        modelo: r.modelo,
        piezas: r.piezas,
        fecha_entrega: cot?.fecha_entrega,
      };
    });
    items.sort(compareItemsProduccionPorFechaEntrega);
    onGuardar(items);
  };

  const handleGuardarSeleccion = async () => {
    setGuardandoSeleccion(true);
    setSeleccionGuardadaMsg(null);
    setError(null);
    try {
      const itemsPayload = seleccionInfo.rows.map((r) => ({
        cotizacion_id: r.cotizacion_id,
        cotizacion_folio: r.cotizacion_folio,
        detalle_id: r.detalle_id,
        modelo: r.modelo,
        piezas: r.piezas,
        precio_unitario: r.precio_unitario,
        costo_unitario: r.costo_unitario,
      }));

      if (seleccionInvalidaSinPrioridad) {
        throw new Error(
          `Antes de guardar entregas posteriores, todas las partidas de cotizaciones con entrega hasta el ${fechaFinVentanaPrioridadFmt} deben tener planeadas todas sus piezas (entre esta y otras semanas).`
        );
      }

      const res = await fetch('/api/produccion-semanal/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semanaOffset,
          gastos_fijos_total: Number(gastosFijosTotal.toFixed(2)),
          ganancias_total: Number(seleccionInfo.gananciasTotal.toFixed(2)),
          estado: 'BORRADOR',
          items: itemsPayload,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo guardar la selección');

      const ctxRes = await fetch(`/api/produccion-semanal/context?semanaOffset=${semanaOffset}`);
      const ctx = await ctxRes.json().catch(() => null);
      if (ctx?.success) {
        setPiezasEnOtrasSemanas((ctx.piezasEnOtrasSemanas as Record<string, number> | undefined) || {});
        const rawItems = (ctx.planItems as PlanItemSemana[] | undefined) || [];
        setPlanItemsCache(rawItems);
        const nextPiezas: Record<string, number> = {};
        for (const x of rawItems) {
          const n = Number(x.piezas) || 0;
          if (n > 0) nextPiezas[x.detalle_id] = n;
        }
        setPiezasPorDetalle(nextPiezas);
      }

      handleGuardar();
      setSeleccionGuardadaMsg(
        itemsPayload.length === 0
          ? 'Plan de esta semana vaciado.'
          : 'Selección guardada. Las piezas que no asignaste aquí siguen disponibles para semanas posteriores.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardandoSeleccion(false);
    }
  };

  /** El botón no puede ir disabled solo por reglas de negocio: el clic explica qué falta. */
  const intentarGenerarPlan = () => {
    if (guardandoPlan) return;
    setError(null);
    if (loadingGastos || loadingCostoBruto) {
      setError('Espera a que termine la validación de gastos fijos y el cálculo de costo bruto (insumos).');
      return;
    }
    if (partidasConAdvertencia.length > 0) {
      setError(
        `Hay ${partidasConAdvertencia.length} partida(s) sin receta de insumos o con insumos sin costo. Corrige en el catálogo de prendas (Insumos por talla) y vuelve a intentar.`
      );
      return;
    }
    if (gastosFijosTotal <= 0) {
      setError(
        'Configura primero los gastos fijos semanales (tarjeta «Gastos fijos semanales» en esta pantalla). Sin ese monto no se puede generar el plan.'
      );
      return;
    }
    if (seleccionInfo.gananciasTotal < gastosFijosTotal) {
      const falta = Math.max(0, gastosFijosTotal - seleccionInfo.gananciasTotal);
      setError(
        `Faltan $${fmtMxn(falta)} para alcanzar gastos semanales. Añade partidas en «Editar selección» o revisa precios y costos.`
      );
      return;
    }
    if (seleccionInvalidaSinPrioridad) {
      setError(
        `Completa el planeamiento de todas las partidas prioritarias (entrega hasta ${fechaFinVentanaPrioridadFmt}) antes de incluir entregas más lejanas.`
      );
      return;
    }
    void handleGenerarPlan();
  };

  const handleGenerarPlan = async () => {
    setGuardandoPlan(true);
    setError(null);
    try {
      if (loadingGastos || loadingCostoBruto) {
        setError('Espera a que termine la validación de gastos y el costo bruto por receta.');
        return;
      }
      if (partidasConAdvertencia.length > 0) {
        setError(
          `Hay ${partidasConAdvertencia.length} partida(s) sin receta de insumos o con insumos sin costo. Corrige esas prendas antes de generar el plan.`
        );
        return;
      }
      if (!minimoAlcanzado) {
        const falta = Math.max(0, gastosFijosTotal - seleccionInfo.gananciasTotal);
        setError(
          `Faltan $${fmtMxn(falta)} para alcanzar gastos semanales. Revisa partidas seleccionadas y costos.`
        );
        return;
      }
      if (seleccionInvalidaSinPrioridad) {
        setError(
          `Completa todas las partidas prioritarias (entrega hasta ${fechaFinVentanaPrioridadFmt}) antes de generar el plan con entregas posteriores.`
        );
        return;
      }
      const payload = {
        semanaOffset,
        gastos_fijos_total: Number(gastosFijosTotal.toFixed(2)),
        ganancias_total: Number(seleccionInfo.gananciasTotal.toFixed(2)),
        estado: 'GENERADO' as const,
        items: seleccionInfo.rows.map((r) => ({
          cotizacion_id: r.cotizacion_id,
          cotizacion_folio: r.cotizacion_folio,
          detalle_id: r.detalle_id,
          modelo: r.modelo,
          piezas: r.piezas,
          precio_unitario: r.precio_unitario,
          costo_unitario: r.costo_unitario,
        })),
      };

      const res = await fetch('/api/produccion-semanal/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'No se pudo guardar el plan');

      const porId = new Map(cotizaciones.map((c) => [c.id, c] as const));
      const filas: FilaPlanTrabajoPdf[] = seleccionInfo.rows.map((r) => {
        const cot = porId.get(r.cotizacion_id);
        return {
          cotizacion: r.cotizacion_folio,
          cliente: cot ? nombreCliente(cot) : '—',
          modelo: r.modelo,
          piezas: r.piezas,
          fechaEntrega: fmtFechaCot(cot?.fecha_entrega),
        };
      });
      setPlanGeneradoPdf({
        tituloSemana: `Semana ${formatWeekRange(monday, sunday)}`,
        filas,
        gastosFijos: Number(gastosFijosTotal.toFixed(2)),
        gananciasTotal: Number(seleccionInfo.gananciasTotal.toFixed(2)),
      });
      handleGuardar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar plan');
    } finally {
      setGuardandoPlan(false);
    }
  };

  if (!mounted) return null;

  const abrirModalPartidas = () => {
    setError(null);
    setModalPartidasAbierto(true);
  };

  const semanaNav = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.5rem 0',
        borderTop: '1px solid #e5e7eb',
      }}
    >
      <button
        type="button"
        onClick={() => setSemanaOffset((s) => s - 1)}
        style={{
          background: '#f3f4f6',
          border: 'none',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
        aria-label="Semana anterior"
      >
        <ChevronLeft size={20} />
        Anterior
      </button>
      <span style={{ fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' }}>
        Semana {formatWeekRange(monday, sunday)}
      </span>
      <button
        type="button"
        onClick={() => setSemanaOffset((s) => s + 1)}
        style={{
          background: '#f3f4f6',
          border: 'none',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
        aria-label="Semana siguiente"
      >
        Siguiente
        <ChevronRight size={20} />
      </button>
    </div>
  );

  const modalPrincipal = (
    <div className="modal-overlay" onClick={handleClosePrincipal}>
      <div
        className="modal-content"
        style={{
          maxWidth: 'min(960px, 100vw - 1.5rem)',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)' }}>Producción semanal</h2>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.4 }}>
                Elige la semana. Usa <strong>Editar selección</strong> para elegir partidas y{' '}
                <strong>Guardar selección</strong> en esa pantalla; cuando veas <strong>Mínimo alcanzado</strong>, usa{' '}
                <strong>Generar plan de trabajo</strong> desde aquí.
              </p>
            </div>
            <button type="button" className="modal-close" onClick={handleClosePrincipal} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
          {semanaNav}
        </div>

        {planGeneradoPdf && (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: '0 1.5rem',
              padding: '1rem 1.1rem',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #6ee7b7',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(6, 95, 70, 0.08)',
            }}
          >
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#065f46' }}>
              Plan de trabajo guardado correctamente
            </p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.9rem', color: '#047857', lineHeight: 1.45 }}>
              {planGeneradoPdf.tituloSemana} quedó registrada con estado <strong>GENERADO</strong> en el sistema.
            </p>
            <div style={{ marginTop: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => abrirPlanTrabajoSemanalPdf(planGeneradoPdf)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <FileDown size={18} aria-hidden />
                Ver plan en PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setPlanGeneradoPdf(null)}>
                Ocultar aviso
              </button>
            </div>
          </div>
        )}

        <div
          className="modal-body"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minHeight: '200px',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto', flex: 1, minHeight: 0 }}>
            <table
              style={{
                width: '100%',
                minWidth: '520px',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
              }}
            >
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Cotización</th>
                  <th style={{ padding: '0.5rem' }}>Cliente</th>
                  <th style={{ padding: '0.5rem' }}>Modelo</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Piezas</th>
                  <th style={{ padding: '0.5rem' }}>Fecha de entrega</th>
                </tr>
              </thead>
              <tbody>
                {filasResumenSemana.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.25rem', textAlign: 'center', color: '#6b7280' }}>
                      No hay partidas en el plan de esta semana. Pulsa <strong>Editar selección</strong> para incluirlas.
                    </td>
                  </tr>
                ) : (
                  filasResumenSemana.map((fila) => (
                    <tr key={fila.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                        <strong>{fila.cotizacion}</strong>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>{fila.cliente}</td>
                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>{fila.modelo}</td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        {fila.piezas}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {fmtFechaCot(fila.fechaEntrega)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div
            style={{
              flexShrink: 0,
              paddingTop: '0.5rem',
              borderTop: '1px solid #e5e7eb',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: minimoAlcanzado ? '#047857' : '#b91c1c' }}>
              {cargandoValidacion ? (
                loadingGastos ? (
                  'Validando gastos fijos…'
                ) : (
                  'Calculando costo bruto por receta (insumos)…'
                )
              ) : gastosFijosTotal <= 0 ? (
                'Configura gastos fijos semanales para poder generar el plan'
              ) : minimoAlcanzado ? (
                'Mínimo alcanzado'
              ) : (
                `Faltan $${fmtMxn(faltanteGastosSemanales)} para alcanzar gastos semanales`
              )}
            </span>
            {!cargandoValidacion && gastosFijosTotal > 0 && (
              <div
                style={{
                  marginTop: '0.65rem',
                  maxWidth: 'min(100%, 340px)',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progresoPct)}
                aria-label="Porcentaje de avance hacia el mínimo semanal"
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.35rem',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Avance hacia el mínimo</span>
                  <span
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: minimoAlcanzado ? '#047857' : '#d97706',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Math.round(progresoPct)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 12,
                    background: '#e5e7eb',
                    borderRadius: 999,
                    overflow: 'hidden',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                  }}
                >
                  <div
                    style={{
                      width: `${progresoPct}%`,
                      height: '100%',
                      background: minimoAlcanzado ? '#10b981' : '#f59e0b',
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>
              </div>
            )}
            {!cargandoValidacion && gastosFijosTotal > 0 && (
              <div
                style={{
                  marginTop: '0.55rem',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: utilidadNetaSemana > 0 ? '#047857' : '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                Utilidad Neta de la Semana: ${fmtMxn(utilidadNetaSemana)}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={abrirModalPartidas}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Pencil size={18} aria-hidden />
              Editar selección
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={intentarGenerarPlan}
              disabled={guardandoPlan}
              aria-disabled={guardandoPlan}
              title={
                guardandoPlan
                  ? undefined
                  : cargandoValidacion
                    ? 'Espera a que terminen gastos fijos y costo bruto (insumos)'
                    : gastosFijosTotal <= 0
                      ? 'Configura gastos fijos semanales primero (pulsa para ver el aviso)'
                      : !minimoAlcanzado
                        ? `Faltan $${fmtMxn(faltanteGastosSemanales)} para alcanzar gastos semanales`
                        : 'Generar y guardar el plan de trabajo'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                ...(!guardandoPlan && !minimoAlcanzado
                  ? { opacity: 0.58, cursor: 'pointer' }
                  : {}),
              }}
            >
              <Check size={18} aria-hidden />
              {guardandoPlan ? 'Generando…' : 'Generar plan de trabajo'}
            </button>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleClosePrincipal}>
            Cerrar
          </button>
        </div>
        {error && !modalPartidasAbierto && (
          <div style={{ color: '#b91c1c', fontSize: '0.9rem', padding: '0 1.5rem 1rem' }}>{error}</div>
        )}
      </div>
    </div>
  );

  const modalPartidas = modalPartidasAbierto && (
    <div
      className="modal-overlay"
      style={{ zIndex: 10050 }}
      onClick={() => setModalPartidasAbierto(false)}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 'min(960px, 100vw - 1.5rem)',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)' }}>Editar selección</h2>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.4 }}>
                Cotizaciones <strong>aprobadas</strong> (orden ascendente por fecha de entrega). Expande e indica
                piezas para <strong>esta semana de plan</strong> (pueden ser menos que el pedido; el resto va a otras
                semanas). Si hay entregas más lejanas, antes debes tener <strong>planeadas todas las piezas</strong> de{' '}
                <strong>cada partida</strong> de las cotizaciones con entrega en la semana del plan o la siguiente (hasta
                el {fechaFinVentanaPrioridadFmt}), sumando lo que pongas aquí y en otras semanas.
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
                Semana {formatWeekRange(monday, sunday)}
              </p>
              {hayCotizacionPosterior && hayCotizacionPrioridad && !reglaPrioridadSemanasCumplida && (
                <div
                  role="status"
                  style={{
                    marginTop: '0.65rem',
                    padding: '0.65rem 0.85rem',
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: 10,
                    fontSize: '0.82rem',
                    color: '#92400e',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Regla de prioridad:</strong> distribuye <strong>todas las piezas</strong> de cada partida de
                  cotizaciones con entrega hasta el <strong>{fechaFinVentanaPrioridadFmt}</strong> (entre esta semana y
                  la siguiente). Después podrás editar entregas posteriores.
                </div>
              )}
            </div>
            <button
              type="button"
              className="modal-close"
              onClick={() => setModalPartidasAbierto(false)}
              aria-label="Cerrar selección de partidas"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          {cotizacionesProduccion.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              No hay cotizaciones en estado <strong>Aprobado</strong>. Cambia el estatus en el historial de
              cotizaciones.
            </p>
          ) : cotizacionesVisibles.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              No hay piezas libres para <strong>esta semana</strong>: en tus cotizaciones aprobadas ya asignaste todas las
              piezas a otras semanas (o no hay partidas).
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {cotizacionesVisibles.map((cot) => (
                <div
                  key={cot.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleExpandirCotizacion(cot.id)}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      background: cotizacionExpandida === cot.id ? '#f9fafb' : '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      fontSize: '0.95rem',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <FileText size={20} color="#6366f1" />
                      <strong>{cot.folio}</strong>
                      <span style={{ color: '#374151', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {nombreCliente(cot)}
                      </span>
                      {!cotizacionPrioritariaParaPlan(cot.fecha_entrega, monday) &&
                        hayCotizacionPosterior &&
                        hayCotizacionPrioridad &&
                        !reglaPrioridadSemanasCumplida && (
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.02em',
                              background: '#fef3c7',
                              color: '#b45309',
                            }}
                            title={`Entrega posterior al ${fechaFinVentanaPrioridadFmt}; desbloquea cuando todas las partidas prioritarias estén totalmente planeadas.`}
                          >
                            Entrega posterior
                          </span>
                        )}
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                        }}
                      >
                        Aprobado
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        Entrega: {fmtFechaCot(cot.fecha_entrega)}
                      </span>
                    </span>
                    <ChevronRight
                      size={20}
                      style={{
                        transform: cotizacionExpandida === cot.id ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {cotizacionExpandida === cot.id && (
                    <div style={{ padding: '0 0.75rem 1rem', borderTop: '1px solid #f3f4f6' }}>
                      {!detallesExpandidos[cot.id] ? (
                        <p style={{ padding: '1rem', color: '#6b7280' }}>Cargando conceptos...</p>
                      ) : (() => {
                        const detallesRaw = detallesExpandidos[cot.id] || [];
                        const detallesMostrar = detallesRaw.filter((d) =>
                          detalleTieneCupoOPiezasEnEstaSemana(d, piezasEnOtrasSemanas, piezasPorDetalle)
                        );
                        if (detallesMostrar.length === 0) {
                          return (
                            <p style={{ padding: '1rem 0', color: '#6b7280', fontSize: '0.9rem' }}>
                              {detallesRaw.length === 0
                                ? 'Sin conceptos en esta cotización.'
                                : 'No hay piezas libres para esta semana (revisa otras semanas o el pedido total).'}
                            </p>
                          );
                        }
                        return (
                          <div style={{ paddingTop: '0.75rem', overflowX: 'auto' }}>
                            <table
                              style={{
                                width: '100%',
                                minWidth: '720px',
                                borderCollapse: 'collapse',
                                fontSize: '0.85rem',
                              }}
                            >
                              <thead>
                                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                                  <th style={{ padding: '0.5rem' }}>Cotización</th>
                                  <th style={{ padding: '0.5rem' }}>Cliente</th>
                                  <th style={{ padding: '0.5rem' }}>Modelo</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Pedido</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Esta semana</th>
                                  <th style={{ padding: '0.5rem' }}>Fecha de entrega</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detallesMostrar.map((d) => {
                                  const maxAqui = maxPiezasEstaSemana(d.id, d.cantidad, piezasEnOtrasSemanas);
                                  const val = piezasPorDetalle[d.id] ?? 0;
                                  const activa = val > 0;
                                  const prioritaria = cotizacionPrioritariaParaPlan(cot.fecha_entrega, monday);
                                  const bloquearPorRegla =
                                    hayCotizacionPosterior &&
                                    hayCotizacionPrioridad &&
                                    !reglaPrioridadSemanasCumplida &&
                                    !prioritaria;
                                  return (
                                    <tr
                                      key={d.id}
                                      style={{
                                        background: activa ? '#ecfdf5' : '#fff',
                                        borderBottom: '1px solid #f3f4f6',
                                        opacity: bloquearPorRegla ? 0.55 : 1,
                                      }}
                                    >
                                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                        <strong>{cot.folio}</strong>
                                      </td>
                                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                        {nombreCliente(cot)}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle' }}>
                                        <strong>{d.prenda_nombre}</strong>
                                        {d.talla ? ` · ${d.talla}` : ''}
                                        {d.color ? ` · ${d.color}` : ''}
                                        {d.costo_id && advertenciaInsumosPorCostoId[String(d.costo_id)] ? (
                                          <span
                                            style={{
                                              display: 'block',
                                              marginTop: 4,
                                              fontSize: '0.75rem',
                                              fontWeight: 800,
                                              color: '#b91c1c',
                                            }}
                                            title="Esta partida no puede usarse para validar mínimos hasta completar insumos y costos."
                                          >
                                            ⚠️{' '}
                                            {advertenciaInsumosPorCostoId[String(d.costo_id)] === 'SIN_INSUMOS'
                                              ? 'Sin insumos asignados'
                                              : 'Insumo(s) sin costo de compra'}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', verticalAlign: 'middle' }}>
                                        {d.cantidad}
                                        {maxAqui < (Number(d.cantidad) || 0) ? (
                                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280' }}>
                                            máx. aquí: {maxAqui}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                        <input
                                          type="number"
                                          min={0}
                                          max={maxAqui}
                                          value={val}
                                          disabled={bloquearPorRegla || maxAqui <= 0}
                                          onChange={(e) =>
                                            setPiezasLinea(
                                              cot,
                                              d,
                                              e.target.value === '' ? 0 : Number(e.target.value)
                                            )
                                          }
                                          title={
                                            bloquearPorRegla
                                              ? `Completa todas las piezas de las cotizaciones con entrega hasta ${fechaFinVentanaPrioridadFmt}`
                                              : undefined
                                          }
                                          aria-label={`Piezas esta semana para ${d.prenda_nombre}`}
                                          style={{
                                            width: 72,
                                            padding: '0.35rem 0.5rem',
                                            borderRadius: 8,
                                            border: '1px solid #d1d5db',
                                            textAlign: 'center',
                                            fontWeight: 600,
                                          }}
                                        />
                                      </td>
                                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                        {fmtFechaCot(cot.fecha_entrega)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e5e7eb',
            background: '#fafafa',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1f2937', letterSpacing: '0.02em' }}>
            {seleccionInfo.rows.length} concepto{seleccionInfo.rows.length !== 1 ? 's' : ''} seleccionado
            {seleccionInfo.rows.length !== 1 ? 's' : ''}
          </p>
          {!cargandoValidacion && gastosFijosTotal > 0 && (
            <div
              style={{ marginTop: '0.85rem', maxWidth: 'min(100%, 340px)', marginLeft: 'auto', marginRight: 'auto' }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progresoPct)}
              aria-label="Porcentaje de avance hacia el mínimo semanal"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.02em' }}>
                  Avance hacia el mínimo
                </span>
                <span
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: minimoAlcanzado ? '#047857' : '#d97706',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(progresoPct)}%
                </span>
              </div>
              <div
                style={{
                  height: 12,
                  background: '#e5e7eb',
                  borderRadius: 999,
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    width: `${progresoPct}%`,
                    height: '100%',
                    background: minimoAlcanzado ? '#10b981' : '#f59e0b',
                    transition: 'width 0.35s ease',
                  }}
                />
              </div>
            </div>
          )}
          {!cargandoValidacion && gastosFijosTotal > 0 && (
            <div
              style={{
                marginTop: '0.55rem',
                fontSize: '0.9rem',
                fontWeight: 800,
                color: utilidadNetaSemana > 0 ? '#047857' : '#0f172a',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Utilidad Neta de la Semana: ${fmtMxn(utilidadNetaSemana)}
            </div>
          )}
          {cargandoValidacion && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              {loadingGastos ? 'Validando gastos…' : 'Calculando costo bruto (insumos)…'}
            </p>
          )}
          {seleccionGuardadaMsg && (
            <p style={{ margin: '0.65rem 0 0', fontSize: '0.85rem', color: '#0369a1' }}>{seleccionGuardadaMsg}</p>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 'min(100%, 280px)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: minimoAlcanzado ? '#047857' : '#b91c1c' }}>
              {cargandoValidacion ? (
                loadingGastos ? (
                  'Validando…'
                ) : (
                  'Calculando costo bruto (insumos)…'
                )
              ) : gastosFijosTotal <= 0 ? (
                'Configura gastos fijos semanales para poder generar el plan'
              ) : minimoAlcanzado ? (
                'Mínimo alcanzado'
              ) : (
                `Faltan $${fmtMxn(faltanteGastosSemanales)} para alcanzar gastos semanales`
              )}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalPartidasAbierto(false)}>
              Volver
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGuardarSeleccion}
              disabled={loadingContext || guardandoSeleccion}
            >
              {guardandoSeleccion ? 'Guardando…' : 'Guardar selección'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.9rem', padding: '0 1.5rem 1rem' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalPrincipal, document.body)}
      {modalPartidas && createPortal(modalPartidas, document.body)}
    </>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, getSupabaseErrorMessage } from '@/lib/supabase';
import type { SatFormaPago, SatMetodoPago } from '@/lib/types';

export type SatCatalogoTipo = 'metodo' | 'forma';

const FALLBACK_METODOS: SatMetodoPago[] = [
  {
    id: 'fallback-pue',
    clave: 'PUE',
    descripcion: 'EFECTIVO',
    activo: true,
    orden: 1,
    es_default: true,
  },
  {
    id: 'fallback-ppd',
    clave: 'PPD',
    descripcion: 'Pago en parcialidades o diferido',
    activo: true,
    orden: 2,
    es_default: false,
  },
];

const FALLBACK_FORMAS: SatFormaPago[] = [
  { id: 'fallback-01', clave: '01', descripcion: 'EFECTIVO', activo: true, orden: 1, es_default: true },
  { id: 'fallback-03', clave: '03', descripcion: 'Transferencia electrónica de fondos', activo: true, orden: 3, es_default: false },
  { id: 'fallback-04', clave: '04', descripcion: 'Tarjeta de crédito', activo: true, orden: 4, es_default: false },
];

function ordenarCatalogo<T extends { orden: number; clave: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
}

export function etiquetaSatPago(item: { clave: string; descripcion: string }): string {
  return `${item.clave} — ${item.descripcion}`;
}

export function textoPdfSatPago(item: { descripcion: string } | null | undefined, fallback: string): string {
  const t = item?.descripcion?.trim();
  return t || fallback;
}

export function useSatCatalogosPago() {
  const [metodos, setMetodos] = useState<SatMetodoPago[]>(FALLBACK_METODOS);
  const [formas, setFormas] = useState<SatFormaPago[]>(FALLBACK_FORMAS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const [mRes, fRes] = await Promise.all([
        supabase.from('sat_metodos_pago').select('*').order('orden', { ascending: true }),
        supabase.from('sat_formas_pago').select('*').order('orden', { ascending: true }),
      ]);
      if (mRes.error) throw mRes.error;
      if (fRes.error) throw fRes.error;
      if ((mRes.data || []).length > 0) setMetodos(ordenarCatalogo(mRes.data as SatMetodoPago[]));
      if ((fRes.data || []).length > 0) setFormas(ordenarCatalogo(fRes.data as SatFormaPago[]));
    } catch (err) {
      console.error('Error cargando catálogos SAT pago:', err);
      setError(getSupabaseErrorMessage(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const metodosActivos = metodos.filter((m) => m.activo);
  const formasActivas = formas.filter((f) => f.activo);

  const metodoDefault = metodosActivos.find((m) => m.es_default) || metodosActivos[0] || FALLBACK_METODOS[0];
  const formaDefault = formasActivas.find((f) => f.es_default) || formasActivas[0] || FALLBACK_FORMAS[0];

  const guardar = async (
    tipo: SatCatalogoTipo,
    payload: Omit<SatMetodoPago, 'id' | 'created_at' | 'updated_at'> & { id?: string }
  ) => {
    const tabla = tipo === 'metodo' ? 'sat_metodos_pago' : 'sat_formas_pago';
    const { id, ...resto } = payload;
    const row = {
      ...resto,
      clave: resto.clave.trim().toUpperCase(),
      descripcion: resto.descripcion.trim(),
      updated_at: new Date().toISOString(),
    };

    if (row.es_default) {
      await supabase.from(tabla).update({ es_default: false }).eq('es_default', true);
    }

    if (id && !id.startsWith('fallback-')) {
      const { error: upErr } = await supabase.from(tabla).update(row).eq('id', id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabase.from(tabla).insert([row]);
      if (insErr) throw insErr;
    }
    await cargar();
  };

  const eliminar = async (tipo: SatCatalogoTipo, id: string) => {
    if (id.startsWith('fallback-')) return;
    const tabla = tipo === 'metodo' ? 'sat_metodos_pago' : 'sat_formas_pago';
    const { error: delErr } = await supabase.from(tabla).delete().eq('id', id);
    if (delErr) throw delErr;
    await cargar();
  };

  return {
    metodos,
    formas,
    metodosActivos,
    formasActivas,
    metodoDefault,
    formaDefault,
    cargando,
    error,
    recargar: cargar,
    guardar,
    eliminar,
  };
}

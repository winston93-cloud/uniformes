'use client';

import { useCallback, useEffect, useState } from 'react';
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

function mensajeErrorUsuario(raw: string): string {
  const linea = raw.split('\n')[0].replace(/^TypeError:\s*/i, '').trim();
  if (/failed to fetch/i.test(linea)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
  }
  if (/duplicate key|23505|already exists/i.test(linea)) {
    return 'Esa clave SAT ya existe. Selecciónala en la lista y pulsa Editar.';
  }
  return linea || 'Error desconocido';
}

async function parseJsonResponse(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { error?: string; metodos?: SatMetodoPago[]; formas?: SatFormaPago[] };
  if (!res.ok) {
    throw new Error(mensajeErrorUsuario(body.error || `HTTP ${res.status}`));
  }
  return body;
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
      const res = await fetch('/api/sat-catalogos-pago', { cache: 'no-store' });
      const data = await parseJsonResponse(res);
      if ((data.metodos || []).length > 0) setMetodos(ordenarCatalogo(data.metodos!));
      if ((data.formas || []).length > 0) setFormas(ordenarCatalogo(data.formas!));
    } catch (err) {
      console.error('Error cargando catálogos SAT pago:', err);
      setError(err instanceof Error ? err.message : mensajeErrorUsuario(String(err)));
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
    const res = await fetch('/api/sat-catalogos-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, ...payload }),
    });
    await parseJsonResponse(res);
    await cargar();
  };

  const eliminar = async (tipo: SatCatalogoTipo, id: string) => {
    if (id.startsWith('fallback-')) return;
    const res = await fetch(`/api/sat-catalogos-pago?tipo=${encodeURIComponent(tipo)}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await parseJsonResponse(res);
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

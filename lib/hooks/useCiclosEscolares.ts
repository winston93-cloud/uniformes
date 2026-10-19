'use client';

import { useState, useEffect } from 'react';

export interface CicloEscolar {
  id: number;
  valor: number;
  nombre: string;
  anio_inicio: number;
  anio_fin: number;
  activo: boolean;
  es_actual: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Ciclos de Winston Servicios. Solo lectura: el catálogo y el ciclo actual se cambian en Winston. */
export function useCiclosEscolares() {
  const [ciclos, setCiclos] = useState<CicloEscolar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCiclos = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ciclos-escolares', { cache: 'no-store' });
      const json = (await res.json()) as { success: boolean; ciclos?: CicloEscolar[]; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudieron cargar los ciclos escolares.');
      setCiclos(json.ciclos ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Error fetching ciclos escolares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCiclos();
  }, []);

  const getCicloActual = () => {
    return ciclos.find(c => c.es_actual);
  };

  const getCiclosActivos = () => {
    return ciclos.filter(c => c.activo);
  };

  return {
    ciclos,
    loading,
    error,
    fetchCiclos,
    getCicloActual,
    getCiclosActivos,
  };
}

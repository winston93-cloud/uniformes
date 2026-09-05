'use client';

import { useState, useEffect } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { EmpresaPrenda } from '@/lib/types';

export type { EmpresaPrenda };

export function useEmpresas() {
  const [empresas, setEmpresas] = useState<EmpresaPrenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmpresas = async (soloActivas: boolean = true) => {
    try {
      setLoading(true);
      let query = insforgeDb().from('empresas').select('*');

      if (soloActivas) {
        query = query.eq('activo', true);
      }

      let { data, error } = await query.order('nombre', { ascending: true });

      if (error && soloActivas) {
        const fallback = await insforgeDb()
          .from('empresas')
          .select('*')
          .order('nombre', { ascending: true });
        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) throw error;
      setEmpresas((data || []) as EmpresaPrenda[]);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching empresas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmpresas(false);
  }, []);

  const createEmpresa = async (
    empresa: Omit<EmpresaPrenda, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const { data, error } = await insforgeDb()
        .from('empresas')
        .insert([empresa])
        .select()
        .single();

      if (error) throw error;
      await fetchEmpresas(false);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updateEmpresa = async (id: string, updates: Partial<EmpresaPrenda>) => {
    try {
      const { data, error } = await insforgeDb()
        .from('empresas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchEmpresas(false);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deleteEmpresa = async (id: string) => {
    try {
      const { error } = await insforgeDb().from('empresas').delete().eq('id', id);

      if (error) throw error;
      await fetchEmpresas(false);
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    empresas,
    loading,
    error,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    refetch: () => fetchEmpresas(false),
  };
}

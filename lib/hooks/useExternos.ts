'use client';

import { useState, useEffect } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Externo } from '../types';

export function useExternos() {
  const [externos, setExternos] = useState<Externo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const escaparWildcards = (valor: string) => {
    return valor.replace(/[%_\\]/g, '\\$&');
  };

  const fetchExternos = async () => {
    try {
      setLoading(true);
      const { data, error } = await insforgeDb()
        .from('externos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setExternos(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching externos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExternos();
  }, []);

  const createExterno = async (externo: Omit<Externo, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await insforgeDb()
        .from('externos')
        .insert([externo])
        .select()
        .single();

      if (error) throw error;
      await fetchExternos();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updateExterno = async (id: string, updates: Partial<Externo>) => {
    try {
      const { data, error } = await insforgeDb()
        .from('externos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchExternos();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deleteExterno = async (id: string) => {
    try {
      const { error } = await insforgeDb().from('externos').delete().eq('id', id);

      if (error) throw error;
      await fetchExternos();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const searchExternos = async (query: string) => {
    try {
      const limpia = query.replace(/\s+/g, ' ').trim();
      if (limpia.length < 2) return [];

      const tokens = limpia
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter((t) => t.length >= 2);

      const terminos = tokens.length > 0 ? tokens : [limpia];
      const porId = new Map<string, Externo>();

      const lotes = await Promise.all(
        terminos.map(async (termino) => {
          const esc = escaparWildcards(termino);
          const { data, error } = await insforgeDb()
            .from('externos')
            .select('*')
            .or(`nombre.ilike.%${esc}%,email.ilike.%${esc}%,telefono.ilike.%${esc}%`)
            .limit(20);
          if (error) throw error;
          return (data || []) as Externo[];
        })
      );

      for (const filas of lotes) {
        for (const row of filas) {
          if (row?.id) porId.set(String(row.id), row);
        }
      }

      const blob = (e: Externo) =>
        `${e.nombre || ''} ${e.email || ''} ${e.telefono || ''}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

      const tokCheck = terminos.map((t) =>
        t
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      );

      return [...porId.values()]
        .filter((e) => {
          if (e.activo === false) return false;
          const b = blob(e);
          return tokCheck.every((t) => b.includes(t));
        })
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
        .slice(0, 20);
    } catch (err: any) {
      console.error('Error searching externos:', err.message || err);
      return [];
    }
  };

  return {
    externos,
    loading,
    error,
    createExterno,
    updateExterno,
    deleteExterno,
    refetch: fetchExternos,
    searchExternos,
  };
}

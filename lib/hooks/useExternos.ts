'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Externo } from '../types';

export function useExternos() {
  const [externos, setExternos] = useState<Externo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExternos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { error } = await supabase
        .from('externos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchExternos();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
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
  };
}


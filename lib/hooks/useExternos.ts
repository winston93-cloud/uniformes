'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
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

  const searchExternos = async (query: string) => {
    console.log('🔎 [useExternos] searchExternos llamado con:', query);
    try {
      const consulta = escaparWildcards(query.trim());
      console.log('🔎 [useExternos] Consulta escapada:', consulta);
      
      if (!consulta) {
        console.log('⏸️ [useExternos] Consulta vacía, retornando []');
        return [];
      }

      console.log('🔎 [useExternos] Ejecutando query en Supabase...');
      const { data, error } = await supabase
        .from('externos')
        .select('*')
        .or(`nombre.ilike.%${consulta}%,email.ilike.%${consulta}%,telefono.ilike.%${consulta}%`)
        .eq('activo', true)
        .order('nombre', { ascending: true })
        .limit(20);

      if (error) {
        console.error('❌ [useExternos] Error de Supabase:', error);
        throw error;
      }
      
      const resultados = data || [];
      console.log('✅ [useExternos] Data recibida:', resultados.length, 'filas');
      console.log('✅ [useExternos] Resultados:', resultados);
      return resultados;
    } catch (err: any) {
      console.error('💥 [useExternos] Excepción capturada:', err.message || err);
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


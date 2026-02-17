'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface CategoriaPrenda {
  id: string;
  nombre: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useCategorias() {
  const [categorias, setCategorias] = useState<CategoriaPrenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategorias = async (soloActivas: boolean = true) => {
    try {
      setLoading(true);
      let query = supabase
        .from('categorias_prendas')
        .select('*');
      
      if (soloActivas) {
        query = query.eq('activo', true);
      }
      
      const { data, error } = await query.order('nombre', { ascending: true });

      if (error) throw error;
      setCategorias(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching categorias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const createCategoria = async (categoria: Omit<CategoriaPrenda, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('categorias_prendas')
        .insert([categoria])
        .select()
        .single();

      if (error) throw error;
      await fetchCategorias();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const updateCategoria = async (id: string, updates: Partial<CategoriaPrenda>) => {
    try {
      const { data, error } = await supabase
        .from('categorias_prendas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchCategorias();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const deleteCategoria = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categorias_prendas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchCategorias();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    categorias,
    loading,
    error,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    refetch: fetchCategorias,
  };
}


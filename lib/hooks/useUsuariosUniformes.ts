'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, getSupabaseErrorMessage } from '@/lib/supabase';
import type { RolUniforme, UsuarioUniforme, EstadoUsuarioUniforme } from '@/lib/types';

export function useUsuariosUniformes() {
  const [usuarios, setUsuarios] = useState<UsuarioUniforme[]>([]);
  const [roles, setRoles] = useState<RolUniforme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarRoles = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('roles_uniformes')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (err) throw err;
    setRoles((data as RolUniforme[]) || []);
  }, []);

  const cargarUsuarios = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('usuarios_uniformes')
      .select(`
        *,
        rol:roles_uniformes (*)
      `)
      .order('created_at', { ascending: false });

    if (err) throw err;
    const rows = (data || []).map((row: Record<string, unknown>) => {
      const r = row.rol;
      const rol = Array.isArray(r) ? r[0] : r;
      return { ...row, rol } as UsuarioUniforme;
    });
    setUsuarios(rows);
  }, []);

  const recargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([cargarRoles(), cargarUsuarios()]);
    } catch (e) {
      setError(getSupabaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cargarRoles, cargarUsuarios]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  async function crearUsuario(payload: {
    nombre: string;
    correo: string;
    rol_id: string;
    estado: EstadoUsuarioUniforme;
  }): Promise<{ ok: boolean; message?: string }> {
    try {
      setError(null);
      const { error: err } = await supabase.from('usuarios_uniformes').insert({
        nombre: payload.nombre.trim(),
        correo: payload.correo.trim().toLowerCase(),
        rol_id: payload.rol_id,
        estado: payload.estado,
      });
      if (err) throw err;
      await cargarUsuarios();
      return { ok: true };
    } catch (e) {
      const msg = getSupabaseErrorMessage(e);
      setError(msg);
      return { ok: false, message: msg };
    }
  }

  async function actualizarUsuario(
    id: string,
    payload: Partial<{
      nombre: string;
      correo: string;
      rol_id: string;
      estado: EstadoUsuarioUniforme;
    }>
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      setError(null);
      const update: Record<string, unknown> = {};
      if (payload.nombre !== undefined) update.nombre = payload.nombre.trim();
      if (payload.correo !== undefined) update.correo = payload.correo.trim().toLowerCase();
      if (payload.rol_id !== undefined) update.rol_id = payload.rol_id;
      if (payload.estado !== undefined) update.estado = payload.estado;

      const { error: err } = await supabase.from('usuarios_uniformes').update(update).eq('id', id);
      if (err) throw err;
      await cargarUsuarios();
      return { ok: true };
    } catch (e) {
      const msg = getSupabaseErrorMessage(e);
      setError(msg);
      return { ok: false, message: msg };
    }
  }

  async function eliminarUsuario(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      setError(null);
      const { error: err } = await supabase.from('usuarios_uniformes').delete().eq('id', id);
      if (err) throw err;
      await cargarUsuarios();
      return { ok: true };
    } catch (e) {
      const msg = getSupabaseErrorMessage(e);
      setError(msg);
      return { ok: false, message: msg };
    }
  }

  return {
    usuarios,
    roles,
    loading,
    error,
    recargar,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
  };
}

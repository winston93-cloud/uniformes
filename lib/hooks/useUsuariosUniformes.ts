'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseErrorMessage } from '@/lib/supabase';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { RolUniforme, UsuarioUniforme, EstadoUsuarioUniforme } from '@/lib/types';

export function useUsuariosUniformes() {
  const [usuarios, setUsuarios] = useState<UsuarioUniforme[]>([]);
  const [roles, setRoles] = useState<RolUniforme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarRoles = useCallback(async () => {
    const { data, error: err } = await insforgeDb()
      .from('roles_uniformes')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (err) throw err;
    setRoles((data as RolUniforme[]) || []);
  }, []);

  const cargarUsuarios = useCallback(async () => {
    const { data, error: err } = await insforgeDb()
      .from('usuarios_uniformes')
      .select(`
        id,
        nombre,
        usuario,
        correo,
        rol_id,
        estado,
        created_at,
        updated_at,
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
    usuario: string;
    correo: string;
    password: string;
    rol_id: string;
    estado: EstadoUsuarioUniforme;
  }): Promise<{ ok: boolean; message?: string }> {
    try {
      setError(null);
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'No se pudo crear el usuario.');
      }
      await cargarUsuarios();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : getSupabaseErrorMessage(e);
      setError(msg);
      return { ok: false, message: msg };
    }
  }

  async function actualizarUsuario(
    id: string,
    payload: Partial<{
      nombre: string;
      usuario: string;
      correo: string;
      password: string;
      rol_id: string;
      estado: EstadoUsuarioUniforme;
    }>
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      setError(null);
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'No se pudo actualizar.');
      }
      await cargarUsuarios();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : getSupabaseErrorMessage(e);
      setError(msg);
      return { ok: false, message: msg };
    }
  }

  async function eliminarUsuario(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      setError(null);
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'No se pudo eliminar.');
      }
      await cargarUsuarios();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : getSupabaseErrorMessage(e);
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

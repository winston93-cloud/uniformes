'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SesionUsuario } from '@/lib/types';
import { getCicloEscolarActual } from '@/lib/utils/cicloEscolar';

interface AuthContextType {
  sesion: SesionUsuario | null;
  loading: boolean;
  sesionError: string | null;
  cicloEscolar: number;
  setCicloEscolar: (ciclo: number) => void;
  iniciarSesion: (usuario: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  cerrarSesion: () => Promise<void>;
  recargarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesionState] = useState<SesionUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [sesionError, setSesionError] = useState<string | null>(null);
  const [cicloEscolar, setCicloEscolarState] = useState<number>(getCicloEscolarActual());

  const aplicarSesion = useCallback((nueva: SesionUsuario | null) => {
    setSesionState(nueva);
    if (nueva) {
      localStorage.setItem('sesion_uniformes', JSON.stringify(nueva));
      setSesionError(null);
    } else {
      localStorage.removeItem('sesion_uniformes');
    }
  }, []);

  const recargarSesion = useCallback(async () => {
    setLoading(true);
    setSesionError(null);
    try {
      const res = await fetch('/api/auth/login', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; sesion?: SesionUsuario };
        if (data.ok && data.sesion) {
          aplicarSesion(data.sesion);
          return;
        }
      }
      aplicarSesion(null);
    } catch {
      aplicarSesion(null);
      setSesionError('No se pudo verificar la sesión.');
    } finally {
      setLoading(false);
    }
  }, [aplicarSesion]);

  useEffect(() => {
    void recargarSesion();
    const cicloGuardado = localStorage.getItem('ciclo_escolar_actual');
    if (cicloGuardado) {
      setCicloEscolarState(parseInt(cicloGuardado, 10));
    }
  }, [recargarSesion]);

  const iniciarSesion = useCallback(
    async (usuario: string, password: string) => {
      setSesionError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; sesion?: SesionUsuario };
      if (!res.ok || !data.ok || !data.sesion) {
        const msg = data.message ?? 'No se pudo iniciar sesión.';
        setSesionError(msg);
        return { ok: false, message: msg };
      }
      aplicarSesion(data.sesion);
      return { ok: true };
    },
    [aplicarSesion]
  );

  const cerrarSesion = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    aplicarSesion(null);
    window.location.href = '/login';
  }, [aplicarSesion]);

  const setCicloEscolar = (nuevoCiclo: number) => {
    setCicloEscolarState(nuevoCiclo);
    localStorage.setItem('ciclo_escolar_actual', nuevoCiclo.toString());
  };

  return (
    <AuthContext.Provider
      value={{
        sesion,
        loading,
        sesionError,
        cicloEscolar,
        setCicloEscolar,
        iniciarSesion,
        cerrarSesion,
        recargarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

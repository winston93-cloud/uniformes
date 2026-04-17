'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SesionUsuario } from '@/lib/types';
import { getCicloEscolarActual } from '@/lib/utils/cicloEscolar';
import { resolverSesionInvitado } from '@/lib/sesion-por-defecto';

interface AuthContextType {
  sesion: SesionUsuario | null;
  loading: boolean;
  sesionError: string | null;
  cicloEscolar: number;
  setCicloEscolar: (ciclo: number) => void;
  setSesion: (sesion: SesionUsuario | null) => void;
  cerrarSesion: () => void;
  recargarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesionState] = useState<SesionUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [sesionError, setSesionError] = useState<string | null>(null);
  const [cicloEscolar, setCicloEscolarState] = useState<number>(getCicloEscolarActual());

  const aplicarSesionInvitado = useCallback(async () => {
    const { sesion: inv, errorDetalle } = await resolverSesionInvitado();
    if (inv) {
      setSesionState(inv);
      localStorage.setItem('sesion_uniformes', JSON.stringify(inv));
      setSesionError(null);
    } else {
      setSesionState(null);
      setSesionError(errorDetalle);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setSesionError(null);
        const sesionGuardada = localStorage.getItem('sesion_uniformes');
        if (sesionGuardada) {
          try {
            const parsed = JSON.parse(sesionGuardada) as SesionUsuario;
            if (parsed?.sucursal_id) {
              setSesionState(parsed);
            } else {
              localStorage.removeItem('sesion_uniformes');
            }
          } catch (error) {
            console.error('Error cargando sesión:', error);
            localStorage.removeItem('sesion_uniformes');
          }
        }

        if (!cancelled && !localStorage.getItem('sesion_uniformes')) {
          await aplicarSesionInvitado();
        }

        const cicloGuardado = localStorage.getItem('ciclo_escolar_actual');
        if (cicloGuardado) {
          setCicloEscolarState(parseInt(cicloGuardado));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [aplicarSesionInvitado]);

  const setSesion = (nuevaSesion: SesionUsuario | null) => {
    setSesionState(nuevaSesion);
    setSesionError(null);
    if (nuevaSesion) {
      localStorage.setItem('sesion_uniformes', JSON.stringify(nuevaSesion));
    } else {
      localStorage.removeItem('sesion_uniformes');
    }
  };

  const setCicloEscolar = (nuevoCiclo: number) => {
    setCicloEscolarState(nuevoCiclo);
    localStorage.setItem('ciclo_escolar_actual', nuevoCiclo.toString());
  };

  const cerrarSesion = () => {
    localStorage.removeItem('sesion_uniformes');
    void (async () => {
      await aplicarSesionInvitado();
      window.location.href = '/dashboard';
    })();
  };

  const recargarSesion = useCallback(async () => {
    setLoading(true);
    setSesionError(null);
    localStorage.removeItem('sesion_uniformes');
    await aplicarSesionInvitado();
    setLoading(false);
  }, [aplicarSesionInvitado]);

  return (
    <AuthContext.Provider
      value={{
        sesion,
        loading,
        sesionError,
        cicloEscolar,
        setCicloEscolar,
        setSesion,
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

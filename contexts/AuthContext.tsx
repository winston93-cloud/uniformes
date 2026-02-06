'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SesionUsuario } from '@/lib/types';
import { getCicloEscolarActual } from '@/lib/utils/cicloEscolar';

interface AuthContextType {
  sesion: SesionUsuario | null;
  loading: boolean;
  cicloEscolar: number;
  setCicloEscolar: (ciclo: number) => void;
  setSesion: (sesion: SesionUsuario | null) => void;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesionState] = useState<SesionUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [cicloEscolar, setCicloEscolarState] = useState<number>(getCicloEscolarActual());

  // Cargar sesión y ciclo escolar del localStorage al iniciar
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('sesion_uniformes');
    if (sesionGuardada) {
      try {
        setSesionState(JSON.parse(sesionGuardada));
      } catch (error) {
        console.error('Error cargando sesión:', error);
        localStorage.removeItem('sesion_uniformes');
      }
    }
    
    const cicloGuardado = localStorage.getItem('ciclo_escolar_actual');
    if (cicloGuardado) {
      setCicloEscolarState(parseInt(cicloGuardado));
    }
    
    setLoading(false);
  }, []);

  const setSesion = (nuevaSesion: SesionUsuario | null) => {
    setSesionState(nuevaSesion);
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
    setSesionState(null);
    localStorage.removeItem('sesion_uniformes');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ sesion, loading, cicloEscolar, setCicloEscolar, setSesion, cerrarSesion }}>
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

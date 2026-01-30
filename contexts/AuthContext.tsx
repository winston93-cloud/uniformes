'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SesionUsuario } from '@/lib/types';

interface AuthContextType {
  sesion: SesionUsuario | null;
  setSesion: (sesion: SesionUsuario | null) => void;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesionState] = useState<SesionUsuario | null>(null);

  // Cargar sesión del localStorage al iniciar
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
  }, []);

  const setSesion = (nuevaSesion: SesionUsuario | null) => {
    setSesionState(nuevaSesion);
    if (nuevaSesion) {
      localStorage.setItem('sesion_uniformes', JSON.stringify(nuevaSesion));
    } else {
      localStorage.removeItem('sesion_uniformes');
    }
  };

  const cerrarSesion = () => {
    setSesionState(null);
    localStorage.removeItem('sesion_uniformes');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ sesion, setSesion, cerrarSesion }}>
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

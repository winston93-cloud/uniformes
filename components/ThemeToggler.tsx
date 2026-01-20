'use client';

import { useEffect } from 'react';

export default function ThemeToggler() {
  useEffect(() => {
    // Obtener el tema actual del localStorage
    const temaActual = localStorage.getItem('degradado-theme') || 'original';
    
    // Alternar al otro tema
    const nuevoTema = temaActual === 'original' ? 'institucional' : 'original';
    
    // Guardar el nuevo tema
    localStorage.setItem('degradado-theme', nuevoTema);
    
    // Aplicar el degradado correspondiente
    if (nuevoTema === 'institucional') {
      // Degradado institucional: Azul marino → Morado → Blanco
      document.documentElement.style.setProperty('--gradient-start', '#1e3a8a');
      document.documentElement.style.setProperty('--gradient-middle', '#8b5cf6');
      document.documentElement.style.setProperty('--gradient-end', '#f8fafc');
    } else {
      // Degradado original: Rosa → Naranja → Amarillo
      document.documentElement.style.setProperty('--gradient-start', '#ec4899');
      document.documentElement.style.setProperty('--gradient-middle', '#f97316');
      document.documentElement.style.setProperty('--gradient-end', '#fbbf24');
    }
    
    console.log(`🎨 Tema aplicado: ${nuevoTema}`);
  }, []);

  return null; // No renderiza nada visible
}

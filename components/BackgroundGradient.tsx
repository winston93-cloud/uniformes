'use client';

import { useEffect } from 'react';

export default function BackgroundGradient() {
  useEffect(() => {
    // Tres gradientes disponibles
    const gradientes = [
      {
        // Rosa → Naranja → Amarillo
        start: '#ec4899',
        middle: '#f97316',
        end: '#fbbf24'
      },
      {
        // Azul marino → Morado → Blanco
        start: '#1e3a8a',
        middle: '#8b5cf6',
        end: '#f8fafc'
      },
      {
        // Verde → Aguamarina → Blanco
        start: '#10b981',
        middle: '#06b6d4',
        end: '#ffffff'
      }
    ];

    // Seleccionar un gradiente aleatorio
    const randomIndex = Math.floor(Math.random() * gradientes.length);
    const gradienteSeleccionado = gradientes[randomIndex];

    // Aplicar el gradiente directamente al body
    const body = document.body;
    body.style.background = `linear-gradient(135deg, ${gradienteSeleccionado.start} 0%, ${gradienteSeleccionado.middle} 50%, ${gradienteSeleccionado.end} 100%)`;
    
    // También actualizar las variables CSS por si acaso
    document.documentElement.style.setProperty('--gradient-start', gradienteSeleccionado.start);
    document.documentElement.style.setProperty('--gradient-middle', gradienteSeleccionado.middle);
    document.documentElement.style.setProperty('--gradient-end', gradienteSeleccionado.end);

    const nombreGradiente = randomIndex === 0 ? 'Rosa-Naranja-Amarillo' : randomIndex === 1 ? 'Azul-Morado-Blanco' : 'Verde-Aguamarina-Blanco';
    console.log(`🎨 Gradiente ${randomIndex + 1}/3 aplicado: ${nombreGradiente}`);
    console.log(`📊 Colores: ${gradienteSeleccionado.start} → ${gradienteSeleccionado.middle} → ${gradienteSeleccionado.end}`);
  }, []); // Solo se ejecuta una vez al montar

  return null; // No renderiza nada visible
}

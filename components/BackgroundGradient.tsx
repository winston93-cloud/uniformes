'use client';

import { useEffect } from 'react';

export default function BackgroundGradient() {
  useEffect(() => {
    // Cinco gradientes disponibles
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
      },
      {
        // Primavera: Rosa claro → Amarillo → Verde claro
        start: '#fd79a8',
        middle: '#fdcb6e',
        end: '#55efc4'
      },
      {
        // Océano Profundo: Azul oscuro → Turquesa → Cyan
        start: '#1e3799',
        middle: '#00d2d3',
        end: '#48dbfb'
      }
    ];

    // Obtener el último índice usado para el carrusel
    const ultimoIndex = parseInt(localStorage.getItem('ultimoGradiente') || '-1');
    
    // Siguiente gradiente en el carrusel (secuencial)
    const siguienteIndex = (ultimoIndex + 1) % gradientes.length;
    
    // Guardar el índice para la próxima recarga
    localStorage.setItem('ultimoGradiente', siguienteIndex.toString());
    
    const gradienteSeleccionado = gradientes[siguienteIndex];
    const currentIndex = siguienteIndex;

    // Aplicar el gradiente directamente al body
    const body = document.body;
    body.style.background = `linear-gradient(135deg, ${gradienteSeleccionado.start} 0%, ${gradienteSeleccionado.middle} 50%, ${gradienteSeleccionado.end} 100%)`;
    
    // También actualizar las variables CSS por si acaso
    document.documentElement.style.setProperty('--gradient-start', gradienteSeleccionado.start);
    document.documentElement.style.setProperty('--gradient-middle', gradienteSeleccionado.middle);
    document.documentElement.style.setProperty('--gradient-end', gradienteSeleccionado.end);

    const nombres = [
      'Rosa-Naranja-Amarillo',
      'Azul-Morado-Blanco',
      'Verde-Aguamarina-Blanco',
      'Primavera (Rosa-Amarillo-Verde)',
      'Océano Profundo (Azul-Turquesa-Cyan)'
    ];
    console.log(`🎨 Carrusel ${currentIndex + 1}/5: ${nombres[currentIndex]}`);
    console.log(`📊 Colores: ${gradienteSeleccionado.start} → ${gradienteSeleccionado.middle} → ${gradienteSeleccionado.end}`);
  }, []); // Solo se ejecuta una vez al montar

  return null; // No renderiza nada visible
}

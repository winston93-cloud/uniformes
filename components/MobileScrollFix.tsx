'use client';

import { useEffect } from 'react';

export default function MobileScrollFix() {
  useEffect(() => {
    // Forzar scroll en dispositivos móviles
    const enableScroll = () => {
      // Asegurar que body y html permitan scroll
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.overflowY = 'auto';
      document.documentElement.style.height = 'auto';
      document.documentElement.style.minHeight = '100%';
      document.documentElement.style.webkitOverflowScrolling = 'touch';
      
      document.body.style.overflow = 'auto';
      document.body.style.overflowY = 'auto';
      document.body.style.height = 'auto';
      document.body.style.minHeight = '100vh';
      document.body.style.webkitOverflowScrolling = 'touch';
      document.body.style.position = 'relative';
      document.body.style.touchAction = 'pan-y';
      
      // Prevenir comportamiento por defecto de iOS que a veces bloquea scroll
      document.addEventListener('touchmove', (e) => {
        // No prevenir el default - permitir scroll
      }, { passive: true });
    };

    enableScroll();

    // Verificar periódicamente en caso de que algo lo sobrescriba
    const interval = setInterval(enableScroll, 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}

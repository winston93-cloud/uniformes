'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Al abrir Uniformes, dispara respaldo vía PHP y luego regresa a /dashboard.
      // Evita bucle si el usuario vuelve a "/" en la misma sesión.
      try {
        const key = 'uniformes_backup_redirect_v1';
        const ya = sessionStorage.getItem(key);
        if (!ya) {
          sessionStorage.setItem(key, '1');
          // Emula migrar.php dentro de Uniformes (sin abrir winston93.edu.mx)
          window.location.replace('/api/alumno/refresh-full?redirect=/dashboard');
          return;
        }
      } catch {
        // Si sessionStorage no está disponible, intentamos de todos modos.
        window.location.replace('/api/alumno/refresh-full?redirect=/dashboard');
        return;
      }
      router.replace('/dashboard');
    }
  }, [loading, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        textAlign: 'center',
        color: 'white',
        fontSize: '1.5rem',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎓</div>
        Cargando Sistema de Uniformes...
      </div>
    </div>
  );
}

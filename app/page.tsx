'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
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

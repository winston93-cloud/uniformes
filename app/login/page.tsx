'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** El login está desactivado; el middleware también redirige `/login` → `/dashboard`. */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <p style={{ color: 'white', fontSize: '1.1rem' }}>Cargando…</p>
    </div>
  );
}

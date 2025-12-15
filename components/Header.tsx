'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();

  const handleIrAlPanel = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Usar window.location para asegurar que funcione siempre
    window.location.href = '/dashboard';
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-button" onClick={onMenuClick}>
          <div className="menu-icon">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '2rem' }}>👔</span>
          <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Winston Churchill
          </span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={handleIrAlPanel} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}>
          🏠 Ir al Panel
        </button>

        <div className="welcome-badge">
          ⭐ Bienvenido, Administrador del Sistema ⭐
        </div>

        <button className="logout-button">
          🚪 Cerrar Sesión
        </button>
      </div>
    </header>
  );
}


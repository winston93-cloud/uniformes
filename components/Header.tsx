'use client';

import Link from 'next/link';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
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
        <Link href="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none', padding: '0.6rem 1.5rem' }}>
          🏠 Ir al Panel
        </Link>

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


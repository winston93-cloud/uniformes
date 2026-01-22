'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ModalCotizacion from './ModalCotizacion';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const [modalCotizacionAbierto, setModalCotizacionAbierto] = useState(false);

  const handleIrAlPanel = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Usar window.location para asegurar que funcione siempre
    window.location.href = '/dashboard';
  };

  return (
    <>
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
              Sistema de Uniformes
            </span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleIrAlPanel} 
            className="btn btn-primary" 
            style={{ padding: '0.6rem 1.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🏠 Ir al Panel
          </button>

          <button 
            onClick={() => setModalCotizacionAbierto(true)} 
            className="btn"
            style={{ 
              padding: '0.6rem 1.5rem', 
              cursor: 'pointer', 
              whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(102, 126, 234, 0.4)',
            }}
          >
            📄 Cotizaciones
          </button>

          <div className="welcome-badge">
            ⭐ Bienvenido, Administrador del Sistema ⭐
          </div>

          <button className="logout-button" style={{ whiteSpace: 'nowrap' }}>
            🚪 Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Modal de Cotización */}
      {modalCotizacionAbierto && (
        <ModalCotizacion onClose={() => setModalCotizacionAbierto(false)} />
      )}
    </>
  );
}


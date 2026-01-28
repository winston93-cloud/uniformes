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
      <header className="header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        {/* Fila superior: Logo/Título a la izquierda, Botones a la derecha */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="header-left">
            <button className="menu-button" onClick={onMenuClick}>
              <div className="menu-icon">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
            
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}>
                <span style={{ fontSize: '1.8rem' }}>🎓</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: '800',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.2',
                }}>
                  Sistema de Uniformes
                </span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '600',
                  color: '#667eea',
                  letterSpacing: '0.05em',
                  opacity: 0.8,
                }}>
                  WINSTON CHURCHILL
                </span>
              </div>
            </Link>
          </div>

          <div className="header-buttons">
            <button 
              onClick={handleIrAlPanel} 
              className="btn btn-primary header-btn" 
              style={{ cursor: 'pointer' }}
            >
              <span className="btn-icon">🏠</span>
              <span className="btn-text">Ir al Panel</span>
            </button>

            <button 
              onClick={() => setModalCotizacionAbierto(true)} 
              className="btn header-btn"
              style={{ 
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(102, 126, 234, 0.4)',
              }}
            >
              <span className="btn-icon">📄</span>
              <span className="btn-text">Cotizaciones</span>
            </button>

            <button className="logout-button header-btn">
              <span className="btn-icon">🚪</span>
              <span className="btn-text">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Fila inferior: Mensaje de bienvenida */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start',
          paddingLeft: '3.5rem', // Alineado con el texto "Sistema de Uniformes"
        }}>
          <div className="welcome-badge" style={{ margin: 0 }}>
            ⭐ Bienvenido, Administrador del Sistema ⭐
          </div>
        </div>
      </header>

      {/* Modal de Cotización */}
      {modalCotizacionAbierto && (
        <ModalCotizacion onClose={() => setModalCotizacionAbierto(false)} />
      )}
    </>
  );
}


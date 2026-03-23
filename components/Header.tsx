'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ModalCotizacion from './ModalCotizacion';
import { useCiclosEscolares } from '@/lib/hooks/useCiclosEscolares';
import { Menu, Home, FileText, LogOut, GraduationCap, Building2, MapPin, BookOpen } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { sesion, cerrarSesion, cicloEscolar, setCicloEscolar } = useAuth();
  const [modalCotizacionAbierto, setModalCotizacionAbierto] = useState(false);
  const { getCiclosActivos } = useCiclosEscolares();
  const ciclosDisponibles = getCiclosActivos();

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
            <button
              className="menu-button"
              onClick={onMenuClick}
              aria-label="Abrir menú de navegación"
            >
              <Menu size={24} strokeWidth={2} />
            </button>
            
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                borderRadius: '12px',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '4px 4px 0 0 rgba(99, 102, 241, 0.2)',
                border: '3px solid rgba(255, 255, 255, 0.3)',
              }}>
                <GraduationCap size={28} color="white" strokeWidth={2} aria-hidden />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: '800',
                  color: '#1E1B4B',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.2',
                }}>
                  Sistema de Uniformes
                </span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '600',
                  color: '#6366F1',
                  letterSpacing: '0.05em',
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
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              aria-label="Ir al panel principal"
            >
              <Home size={18} aria-hidden />
              <span className="btn-text">Ir al Panel</span>
            </button>

            <button 
              onClick={() => setModalCotizacionAbierto(true)} 
              className="btn header-btn"
              style={{ 
                cursor: 'pointer',
                background: '#6366F1',
                color: 'white',
                border: '3px solid rgba(255,255,255,0.3)',
                fontWeight: 'bold',
                boxShadow: '4px 4px 0 0 rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              aria-label="Abrir cotizaciones"
            >
              <FileText size={18} aria-hidden />
              <span className="btn-text">Cotizaciones</span>
            </button>

            <button 
              className="logout-button header-btn"
              onClick={cerrarSesion}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} aria-hidden />
              <span className="btn-text">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Fila inferior: Mensaje de bienvenida y sucursal */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: '1rem',
          paddingLeft: '3.5rem',
          paddingRight: '1rem',
        }}>
          <div className="welcome-badge" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Bienvenido, {sesion?.usuario_username || 'Usuario'}
          </div>
          {sesion && (
            <div style={{
              background: sesion.es_matriz ? '#6366F1' : '#10B981',
              color: 'white',
              padding: '0.4rem 1rem',
              borderRadius: '1rem',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow: '3px 3px 0 0 rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              {sesion.es_matriz ? <Building2 size={16} aria-hidden /> : <MapPin size={16} aria-hidden />}
              {sesion.sucursal_nombre}
            </div>
          )}
          
          {/* Selector de Ciclo Escolar — indicador visual activo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <BookOpen size={18} color="#6366F1" aria-hidden />
            <span style={{
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#1E1B4B',
            }}>
              Ciclo:
            </span>
            <select
              value={cicloEscolar}
              onChange={(e) => setCicloEscolar(parseInt(e.target.value))}
              style={{
                background: '#F59E0B',
                color: '#1E1B4B',
                padding: '0.4rem 0.8rem',
                borderRadius: '1rem',
                border: '3px solid rgba(255,255,255,0.4)',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '3px 3px 0 0 rgba(245, 158, 11, 0.4)',
                outline: 'none',
              }}
              aria-label="Seleccionar ciclo escolar activo"
            >
              {ciclosDisponibles.map(ciclo => (
                <option 
                  key={ciclo.id} 
                  value={ciclo.valor}
                  style={{
                    background: 'white',
                    color: '#1f2937',
                    fontWeight: 'bold',
                  }}
                >
                  {ciclo.nombre}
                </option>
              ))}
            </select>
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


'use client';

import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';

export default function ProduccionSemanalPage() {
  const { sesion } = useAuth();

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '700', 
          color: 'white', 
          textShadow: '0 2px 10px rgba(0,0,0,0.2)', 
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          📅 Módulo de Producción Semanal
        </h1>
        <p style={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          textAlign: 'center',
          fontSize: '1.1rem',
          marginBottom: '3rem'
        }}>
          Planificación y seguimiento de la producción semanal
        </p>

        {/* Botón de regreso */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <Link href="/dashboard">
            <button className="btn btn-secondary" style={{ 
              padding: '0.75rem 2rem',
              fontSize: '1rem'
            }}>
              ← Volver al Panel Principal
            </button>
          </Link>
        </div>

        {/* Tarjetas Entrada / Salida - UI UX MAX PRO */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          maxWidth: '900px',
          margin: '0 auto',
        }}>
          {/* Tarjeta Entrada */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 95, 70, 0.35) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '2.5rem',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 50px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-50%',
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.95) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              fontSize: '2rem',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            }}>
              📥
            </div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              color: 'white',
              margin: '0 0 0.5rem 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>
              Entrada
            </h2>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1rem',
              margin: 0,
              lineHeight: 1.5,
            }}>
              Registro de insumos y materiales que ingresan a producción
            </p>
          </div>

          {/* Tarjeta Salida */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.25) 0%, rgba(220, 38, 38, 0.35) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '2.5rem',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 50px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-50%',
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.9) 0%, rgba(220, 38, 38, 0.95) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              fontSize: '2rem',
              boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)',
            }}>
              📤
            </div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              color: 'white',
              margin: '0 0 0.5rem 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>
              Salida
            </h2>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1rem',
              margin: 0,
              lineHeight: 1.5,
            }}>
              Registro de prendas terminadas y productos que salen de producción
            </p>
          </div>
        </div>

        <p style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          textAlign: 'center',
          marginTop: '2rem',
          fontSize: '0.95rem',
        }}>
          Módulo en desarrollo — funcionalidades próximamente
        </p>
      </div>
    </LayoutWrapper>
  );
}

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
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <Link href="/dashboard">
            <button className="btn btn-secondary" style={{ 
              padding: '0.75rem 2rem',
              fontSize: '1rem'
            }}>
              ← Volver al Panel Principal
            </button>
          </Link>
        </div>

        <div className="card" style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.95)', 
            textAlign: 'center',
            margin: 0,
          }}>
            Módulo en desarrollo. Aquí se integrará la planificación y seguimiento de la producción semanal.
          </p>
        </div>
      </div>
    </LayoutWrapper>
  );
}

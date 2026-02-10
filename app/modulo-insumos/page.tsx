'use client';

import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import Link from 'next/link';

export default function ModuloInsumosPage() {
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
          🧵 Módulo de Insumos
        </h1>
        <p style={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          textAlign: 'center',
          fontSize: '1.1rem',
          marginBottom: '3rem'
        }}>
          Gestión completa de materiales e insumos para fabricación
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

        <div className="grid-container" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          {/* Catálogo de Insumos */}
          <Link 
            href="/insumos" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #7dd3c0 0%, #5fb8a6 100%)',
              border: '2px solid rgba(127, 211, 192, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              🧵
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Catálogo de Insumos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Gestión de materiales e insumos para fabricación de prendas
            </p>
          </Link>

          {/* Presentaciones */}
          <Link 
            href="/presentaciones" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #7dd3c0 0%, #5fb8a6 100%)',
              border: '2px solid rgba(127, 211, 192, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📦
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Presentaciones
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Unidades de medida y presentaciones para insumos
            </p>
          </Link>

          {/* Inventario de Insumos */}
          <Link 
            href="/inventario-insumos" 
            className="card"
            style={{
              background: 'linear-gradient(135deg, #7dd3c0 0%, #5fb8a6 100%)',
              border: '2px solid rgba(127, 211, 192, 0.4)',
            }}
          >
            <div 
              style={{
                fontSize: '2.5rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              📊
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Inventario de Insumos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Control de stock y movimientos de materiales
            </p>
          </Link>
        </div>
      </div>
    </LayoutWrapper>
  );
}

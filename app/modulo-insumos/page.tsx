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

        <div className="grid-container">
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
                fontSize: '3rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              🧵
            </div>
            <h3 style={{ 
              margin: '0 0 0.75rem 0',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Catálogo de Insumos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.5'
            }}>
              Gestión de materiales e insumos para fabricación de prendas. Alta, baja, modificación y consulta.
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
                fontSize: '3rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              📦
            </div>
            <h3 style={{ 
              margin: '0 0 0.75rem 0',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Presentaciones
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.5'
            }}>
              Unidades de medida y presentaciones para insumos (kilo, metro, bolsa, rollo, etc.)
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
                fontSize: '3rem',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              📊
            </div>
            <h3 style={{ 
              margin: '0 0 0.75rem 0',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'white',
            }}>
              Inventario de Insumos
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.5'
            }}>
              Control de stock y movimientos de materiales. Consulta de existencias y alertas.
            </p>
          </Link>
        </div>
      </div>
    </LayoutWrapper>
  );
}

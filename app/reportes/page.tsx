'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import ModalReportes from '@/components/ModalReportes';

export default function ReportesPage() {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 className="page-title">
          📊 Reportes y Estadísticas
          <span className="title-icon">📈</span>
        </h1>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem' }}>
            Genera reportes detallados de ventas y analiza el desempeño de tu negocio
          </p>
        </div>

        <div className="cards-grid">
          {/* Reportes de Ventas */}
          <div 
            className="card"
            onClick={() => setModalAbierto(true)}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-icon purple">
              📊
            </div>
            <h3 className="card-title">Reportes de Ventas</h3>
            <p className="card-description">
              Genera reportes por rango de fechas o folios. Visualiza ventas agrupadas por prenda y talla.
            </p>
          </div>

          {/* Placeholder: Reportes de Inventario */}
          <div className="card" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            <div className="card-icon blue">
              📦
            </div>
            <h3 className="card-title">Reportes de Inventario</h3>
            <p className="card-description">
              Control de stock, entradas y salidas de inventario
            </p>
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#f59e0b',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}>
              Próximamente
            </div>
          </div>

          {/* Placeholder: Reportes Financieros */}
          <div className="card" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            <div className="card-icon green">
              💰
            </div>
            <h3 className="card-title">Reportes Financieros</h3>
            <p className="card-description">
              Análisis de ingresos, egresos y utilidades del negocio
            </p>
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#f59e0b',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}>
              Próximamente
            </div>
          </div>

          {/* Placeholder: Estadísticas de Clientes */}
          <div className="card" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            <div className="card-icon orange">
              👥
            </div>
            <h3 className="card-title">Estadísticas de Clientes</h3>
            <p className="card-description">
              Análisis de comportamiento y preferencias de clientes
            </p>
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#f59e0b',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}>
              Próximamente
            </div>
          </div>
        </div>
      </div>

      {modalAbierto && (
        <ModalReportes onClose={() => setModalAbierto(false)} />
      )}
    </LayoutWrapper>
  );
}

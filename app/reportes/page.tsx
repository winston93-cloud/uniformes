'use client';

import LayoutWrapper from '@/components/LayoutWrapper';

export default function ReportesPage() {
  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '3rem' }}>
          📈 Reportes y Estadísticas
        </h1>

        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div className="card">
            <div className="card-icon orange">
              📊
            </div>
            <h3 className="card-title">Ventas por Período</h3>
            <p className="card-description">
              Reporte de ventas diarias, semanales y mensuales
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Generar Reporte
            </button>
          </div>

          <div className="card">
            <div className="card-icon purple">
              👕
            </div>
            <h3 className="card-title">Prendas Más Vendidas</h3>
            <p className="card-description">
              Top de productos con mayor demanda
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Generar Reporte
            </button>
          </div>

          <div className="card">
            <div className="card-icon green">
              📦
            </div>
            <h3 className="card-title">Estado de Inventario</h3>
            <p className="card-description">
              Stock actual y productos con stock bajo
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Generar Reporte
            </button>
          </div>

          <div className="card">
            <div className="card-icon blue">
              💰
            </div>
            <h3 className="card-title">Ingresos y Ganancias</h3>
            <p className="card-description">
              Análisis financiero y márgenes de ganancia
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Generar Reporte
            </button>
          </div>

          <div className="card">
            <div className="card-icon yellow">
              👨‍🎓
            </div>
            <h3 className="card-title">Clientes Frecuentes</h3>
            <p className="card-description">
              Alumnos y clientes con más compras
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Generar Reporte
            </button>
          </div>

          <div className="card">
            <div className="card-icon orange">
              📉
            </div>
            <h3 className="card-title">Pedidos Pendientes</h3>
            <p className="card-description">
              Pedidos sin entregar y por liquidar
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Generar Reporte
            </button>
          </div>
        </div>

        <div className="table-container" style={{ marginTop: '3rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>Resumen Rápido</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(251, 146, 60, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ec4899' }}>250</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Pedidos Totales</div>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981' }}>$45,000</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Ventas Totales</div>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#3b82f6' }}>180</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Alumnos Registrados</div>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#fbbf24' }}>1,250</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Prendas en Stock</div>
            </div>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}


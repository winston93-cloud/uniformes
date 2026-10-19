'use client';

import LayoutWrapper from '@/components/LayoutWrapper';
import { useCiclosEscolares } from '@/lib/hooks/useCiclosEscolares';

const badge = {
  padding: '0.4rem 1rem',
  borderRadius: '8px',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  display: 'inline-block',
} as const;

export default function CiclosEscolaresPage() {
  const { ciclos, loading, error } = useCiclosEscolares();

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="main-container">
          <p>Cargando ciclos escolares...</p>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 className="page-title" style={{ marginBottom: '0.75rem' }}>
          📚 Catálogo de Ciclos Escolares
        </h1>
        <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
          Los ciclos escolares y el ciclo actual se administran en Winston Servicios; aquí solo se consultan.
        </p>

        {error && (
          <p style={{ marginBottom: '1rem', color: '#dc2626' }}>❌ {error}</p>
        )}

        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', color: '#374151' }}>Valor</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', color: '#374151' }}>Ciclo Escolar</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}>Actual</th>
              </tr>
            </thead>
            <tbody>
              {ciclos.map((ciclo) => (
                <tr key={ciclo.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      background: '#f3f4f6',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      color: '#667eea',
                    }}>
                      {ciclo.valor}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '600' }}>{ciclo.nombre}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{
                      ...badge,
                      background: ciclo.activo ? '#10b981' : '#ef4444',
                      color: 'white',
                    }}>
                      {ciclo.activo ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {ciclo.es_actual ? (
                      <span style={{ ...badge, background: '#f59e0b', color: 'white' }}>⭐ Actual</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWrapper>
  );
}

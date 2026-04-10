'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useInsumos } from '@/lib/hooks/useInsumos';

export const dynamic = 'force-dynamic';

export default function InventarioInsumosPage() {
  const { sesion } = useAuth();
  const { insumos, loading } = useInsumos();
  const [busqueda, setBusqueda] = useState('');

  // Filtrar insumos por búsqueda
  const insumosFiltrados = insumos.filter(insumo =>
    insumo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (insumo.codigo && insumo.codigo.toLowerCase().includes(busqueda.toLowerCase())) ||
    (insumo.presentacion?.nombre && insumo.presentacion.nombre.toLowerCase().includes(busqueda.toLowerCase())) ||
    (insumo.unidad_medida && insumo.unidad_medida.toLowerCase().includes(busqueda.toLowerCase()))
  );

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="main-container">
          <div className="loading">
            <div className="spinner"></div>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            color: 'white', 
            textShadow: '0 2px 10px rgba(0,0,0,0.2)', 
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            📦 Inventario de Insumos
          </h1>
          <p style={{ 
            color: 'white', 
            textAlign: 'center',
            fontSize: '1.1rem',
            marginBottom: '2rem'
          }}>
            Control de stock y movimientos de materiales e insumos
          </p>
        </div>

        {/* Buscador */}
        <div style={{ marginBottom: '1.5rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
          <input
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por nombre, código, proveedor o unidad..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
        </div>

        {/* Tabla de Inventario */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Insumo</th>
                <th>Proveedor</th>
                <th>Unidad</th>
                <th>Stock Existente</th>
                <th>Stock Actual</th>
                <th>Stock Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {insumosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron insumos con ese criterio.' : 'No hay insumos registrados.'}
                  </td>
                </tr>
              ) : (
                insumosFiltrados.map((insumo) => {
                  const stockActual = insumo.stock || 0;
                  const stockMinimo = insumo.stock_minimo || 0;
                  const porcentaje = insumo.stock_inicial 
                    ? Math.round((stockActual / insumo.stock_inicial) * 100)
                    : 0;
                  
                  let colorStock = '#10b981'; // Verde
                  if (stockActual <= stockMinimo) {
                    colorStock = '#ef4444'; // Rojo
                  } else if (stockActual <= stockMinimo * 1.5) {
                    colorStock = '#f59e0b'; // Naranja
                  }

                  return (
                    <tr key={insumo.id}>
                      <td data-label="Código" style={{ 
                        fontFamily: 'monospace', 
                        fontWeight: '600',
                        fontSize: '0.9rem'
                      }}>
                        {insumo.codigo}
                      </td>
                      <td data-label="Insumo" style={{ fontWeight: '600' }}>
                        {insumo.nombre}
                      </td>
                      <td data-label="Proveedor">
                        <span className="badge badge-info">
                          {insumo.presentacion?.nombre || '-'}
                        </span>
                      </td>
                      <td data-label="Unidad">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: '#dbeafe',
                            color: '#1e3a8a',
                            border: '1px solid #93c5fd',
                            fontWeight: 600,
                          }}
                        >
                          {(insumo.unidad_medida && insumo.unidad_medida.trim()) || 'unidades'}
                        </span>
                      </td>
                      <td data-label="Stock Existente" style={{ 
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#64748b'
                      }}>
                        {insumo.stock_inicial?.toFixed(2) || '0.00'}
                      </td>
                      <td data-label="Stock Actual" style={{ 
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '1.1rem',
                        color: colorStock
                      }}>
                        {stockActual.toFixed(2)}
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#64748b',
                          fontWeight: '400',
                          marginTop: '0.25rem'
                        }}>
                          {porcentaje}%
                        </div>
                      </td>
                      <td data-label="Stock Mínimo" style={{ 
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#f59e0b'
                      }}>
                        {stockMinimo.toFixed(2)}
                      </td>
                      <td data-label="Estado">
                        {stockActual <= stockMinimo ? (
                          <span className="badge badge-danger">
                            ⚠️ Crítico
                          </span>
                        ) : stockActual <= stockMinimo * 1.5 ? (
                          <span className="badge" style={{ 
                            backgroundColor: '#fef3c7',
                            color: '#92400e'
                          }}>
                            ⚠️ Bajo
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            ✓ Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Resumen */}
        {insumosFiltrados.length > 0 && (
          <div style={{
            marginTop: '2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Total Insumos
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>
                {insumosFiltrados.length}
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Stock Crítico
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444' }}>
                {insumosFiltrados.filter(i => (i.stock || 0) <= (i.stock_minimo || 0)).length}
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Stock Bajo
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>
                {insumosFiltrados.filter(i => {
                  const stock = i.stock || 0;
                  const minimo = i.stock_minimo || 0;
                  return stock > minimo && stock <= minimo * 1.5;
                }).length}
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Stock Normal
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
                {insumosFiltrados.filter(i => {
                  const stock = i.stock || 0;
                  const minimo = i.stock_minimo || 0;
                  return stock > minimo * 1.5;
                }).length}
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}

'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import ModalSucursal from '@/components/ModalSucursal';
import { useSucursales } from '@/lib/hooks/useSucursales';

export default function SucursalesPage() {
  const { sucursales, loading, recargar } = useSucursales();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [sucursalEditar, setSucursalEditar] = useState<any>(null);

  const handleNuevaSucursal = () => {
    setSucursalEditar(null);
    setModalAbierto(true);
  };

  const handleEditarSucursal = (sucursal: any) => {
    setSucursalEditar(sucursal);
    setModalAbierto(true);
  };

  const handleCerrarModal = () => {
    setModalAbierto(false);
    setSucursalEditar(null);
    recargar();
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <h1 className="page-title">
            🏢 Catálogo de Sucursales
          </h1>
          <button 
            className="btn btn-primary"
            onClick={handleNuevaSucursal}
          >
            ➕ Nueva Sucursal
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner"></div>
            <p>Cargando sucursales...</p>
          </div>
        ) : sucursales.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏢</div>
            <h3>No hay sucursales registradas</h3>
            <p>Comienza agregando la primera sucursal</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Teléfono</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sucursales.map((sucursal) => (
                  <tr key={sucursal.id}>
                    <td>
                      <code style={{
                        background: '#f3f4f6',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                      }}>
                        {sucursal.codigo}
                      </code>
                    </td>
                    <td style={{ fontWeight: '600' }}>{sucursal.nombre}</td>
                    <td>{sucursal.direccion || '-'}</td>
                    <td>{sucursal.telefono || '-'}</td>
                    <td>
                      {sucursal.es_matriz ? (
                        <span style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                        }}>
                          🏛️ MATRIZ
                        </span>
                      ) : (
                        <span style={{
                          background: '#e5e7eb',
                          color: '#374151',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                        }}>
                          📍 Sucursal
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        background: sucursal.activo ? '#d1fae5' : '#fee2e2',
                        color: sucursal.activo ? '#065f46' : '#991b1b',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                      }}>
                        {sucursal.activo ? '✅ Activa' : '❌ Inactiva'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleEditarSucursal(sucursal)}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalSucursal
          sucursal={sucursalEditar}
          onClose={handleCerrarModal}
        />
      )}
    </LayoutWrapper>
  );
}

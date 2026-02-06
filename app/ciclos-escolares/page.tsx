'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCiclosEscolares, type CicloEscolar } from '@/lib/hooks/useCiclosEscolares';

const BASE_YEAR = 2003;

export default function CiclosEscolaresPage() {
  const { ciclos, loading, crearCiclo, actualizarCiclo, eliminarCiclo, marcarComoActual } = useCiclosEscolares();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cicloEditando, setCicloEditando] = useState<CicloEscolar | null>(null);
  const [anioInicio, setAnioInicio] = useState<number>(new Date().getFullYear());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const nuevoCiclo = {
      valor: anioInicio - BASE_YEAR,
      nombre: `${anioInicio}-${anioInicio + 1}`,
      anio_inicio: anioInicio,
      anio_fin: anioInicio + 1,
      activo: true,
      es_actual: false,
    };

    const resultado = await crearCiclo(nuevoCiclo);
    
    if (resultado.success) {
      alert('✅ Ciclo escolar creado correctamente');
      setMostrarFormulario(false);
      setAnioInicio(new Date().getFullYear());
    } else {
      alert(`❌ Error: ${resultado.error}`);
    }
  };

  const handleEliminar = async (id: number, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar el ciclo ${nombre}?\n\n⚠️ Esto puede afectar registros de alumnos.`)) {
      return;
    }

    const resultado = await eliminarCiclo(id);
    
    if (resultado.success) {
      alert('✅ Ciclo escolar eliminado');
    } else {
      alert(`❌ Error: ${resultado.error}`);
    }
  };

  const handleMarcarActual = async (id: number, nombre: string) => {
    if (!confirm(`¿Marcar ${nombre} como ciclo escolar actual?`)) {
      return;
    }

    const resultado = await marcarComoActual(id);
    
    if (resultado.success) {
      alert('✅ Ciclo escolar actualizado');
    } else {
      alert(`❌ Error: ${resultado.error}`);
    }
  };

  const handleToggleActivo = async (ciclo: CicloEscolar) => {
    const resultado = await actualizarCiclo(ciclo.id, { activo: !ciclo.activo });
    
    if (!resultado.success) {
      alert(`❌ Error: ${resultado.error}`);
    }
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title">
            📚 Catálogo de Ciclos Escolares
          </h1>
          <button
            onClick={() => setMostrarFormulario(true)}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              border: 'none',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            }}
          >
            ➕ Nuevo Ciclo Escolar
          </button>
        </div>

        {/* Tabla de Ciclos */}
        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', color: '#374151' }}>Valor</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', color: '#374151' }}>Ciclo Escolar</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}>Actual</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}>Acciones</th>
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
                    <button
                      onClick={() => handleToggleActivo(ciclo)}
                      style={{
                        background: ciclo.activo 
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        padding: '0.4rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {ciclo.activo ? '✓ Activo' : '✗ Inactivo'}
                    </button>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {ciclo.es_actual ? (
                      <span style={{
                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        color: 'white',
                        padding: '0.4rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        display: 'inline-block',
                      }}>
                        ⭐ Actual
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarcarActual(ciclo.id, ciclo.nombre)}
                        style={{
                          background: '#f3f4f6',
                          color: '#667eea',
                          padding: '0.4rem 1rem',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        Marcar como actual
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleEliminar(ciclo.id, ciclo.nombre)}
                      disabled={ciclo.es_actual}
                      style={{
                        background: ciclo.es_actual 
                          ? '#e5e7eb' 
                          : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        padding: '0.4rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        cursor: ciclo.es_actual ? 'not-allowed' : 'pointer',
                        opacity: ciclo.es_actual ? 0.5 : 1,
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Nuevo Ciclo */}
        {mostrarFormulario && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              background: 'white',
              borderRadius: '15px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            }}>
              <h2 style={{ marginBottom: '1.5rem', color: '#667eea' }}>➕ Nuevo Ciclo Escolar</h2>
              
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Año de Inicio:
                  </label>
                  <input
                    type="number"
                    value={anioInicio}
                    onChange={(e) => setAnioInicio(parseInt(e.target.value))}
                    min={2000}
                    max={2050}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                    }}
                  />
                </div>

                <div style={{
                  background: '#f3f4f6',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                }}>
                  <p><strong>Vista previa:</strong></p>
                  <p>Valor: <strong>{anioInicio - BASE_YEAR}</strong></p>
                  <p>Nombre: <strong>{anioInicio}-{anioInicio + 1}</strong></p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarFormulario(false)}
                    style={{
                      flex: 1,
                      background: '#e5e7eb',
                      color: '#374151',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    ✗ Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}

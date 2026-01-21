'use client';

import { useInsumosFaltantes } from '@/lib/hooks/useInsumosFaltantes';
import { useState } from 'react';

export default function TarjetaInsumosFaltantes() {
  const { insumosFaltantes, cargando, error, recargar } = useInsumosFaltantes();
  const [expandido, setExpandido] = useState(false);

  // Determinar el color de la tarjeta según la situación
  const getColorEstado = () => {
    if (cargando) return 'blue';
    if (error) return 'red';
    if (insumosFaltantes.length === 0) return 'green';
    if (insumosFaltantes.length > 10) return 'red';
    if (insumosFaltantes.length > 5) return 'orange';
    return 'yellow';
  };

  const getMensajeEstado = () => {
    if (cargando) return 'Calculando...';
    if (error) return 'Error al calcular';
    if (insumosFaltantes.length === 0) return '✅ No hay pedidos pendientes';
    return `⚠️ ${insumosFaltantes.length} insumos necesarios`;
  };

  const colorEstado = getColorEstado();

  return (
    <div 
      className={`card card-insumos-faltantes ${expandido ? 'expandido' : ''}`}
      style={{ 
        gridColumn: '1 / -1',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: '3px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Header de la tarjeta */}
      <div 
        className="card-header-insumos"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '1rem',
        }}
        onClick={() => setExpandido(!expandido)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div 
            className="card-icon"
            style={{
              fontSize: '3rem',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '0.5rem',
            }}
          >
            📋
          </div>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.8rem',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
            }}>
              Insumos Necesarios para Producción
            </h2>
            <p style={{ 
              margin: '0.5rem 0 0 0', 
              fontSize: '1rem',
              opacity: 0.9,
            }}>
              Basado en pedidos pendientes de entrega
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div 
            className={`badge badge-${colorEstado}`}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {getMensajeEstado()}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              recargar();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            🔄 Actualizar
          </button>

          <span style={{ fontSize: '1.5rem' }}>
            {expandido ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Contenido expandible */}
      {expandido && (
        <div 
          className="card-body-insumos"
          style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.15)',
            borderTop: '2px solid rgba(255, 255, 255, 0.2)',
            maxHeight: '600px',
            overflowY: 'auto',
          }}
        >
          {cargando && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ 
                border: '4px solid rgba(255, 255, 255, 0.3)',
                borderTop: '4px solid white',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                margin: '0 auto',
                animation: 'spin 1s linear infinite',
              }}></div>
              <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
                Calculando insumos necesarios...
              </p>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(255, 0, 0, 0.2)',
              border: '2px solid rgba(255, 0, 0, 0.5)',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center',
            }}>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>
                ❌ Error: {error}
              </p>
            </div>
          )}

          {!cargando && !error && insumosFaltantes.length === 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                ¡Todo al día!
              </h3>
              <p style={{ margin: 0, fontSize: '1.1rem', opacity: 0.9 }}>
                No hay pedidos pendientes que requieran insumos
              </p>
            </div>
          )}

          {!cargando && !error && insumosFaltantes.length > 0 && (
            <div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ 
                  margin: '0 0 0.5rem 0', 
                  fontSize: '1.3rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  📊 Resumen de Compra
                </h3>
                <p style={{ margin: 0, fontSize: '1rem', opacity: 0.9 }}>
                  Se necesitan <strong>{insumosFaltantes.length}</strong> tipos de insumos diferentes para completar los pedidos pendientes
                </p>
              </div>

              <div className="tabla-insumos-faltantes">
                <table style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: '0',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  <thead>
                    <tr style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                    }}>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                      }}>
                        #
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                      }}>
                        Código
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                      }}>
                        Insumo
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'right',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                      }}>
                        Cantidad a Pedir
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                      }}>
                        Unidad
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {insumosFaltantes.map((insumo, index) => (
                      <tr 
                        key={insumo.insumo_id}
                        style={{
                          background: index % 2 === 0 
                            ? 'rgba(255, 255, 255, 0.05)' 
                            : 'rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 
                            ? 'rgba(255, 255, 255, 0.05)' 
                            : 'rgba(255, 255, 255, 0.1)';
                        }}
                      >
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'monospace' }}>
                          {insumo.insumo_codigo}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>
                          {insumo.insumo_nombre}
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          textAlign: 'right',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                        }}>
                          {insumo.cantidad_necesaria.toFixed(2)}
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          textAlign: 'center',
                          fontStyle: 'italic',
                        }}>
                          {insumo.presentacion_nombre}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.95rem',
                  opacity: 0.9,
                }}>
                  💡 <strong>Tip:</strong> Estos cálculos están basados en los pedidos con estado "PEDIDO" (pendientes de entrega)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .card-insumos-faltantes {
          transition: all 0.3s ease;
        }

        .card-insumos-faltantes.expandido {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}

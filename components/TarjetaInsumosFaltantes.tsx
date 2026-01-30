'use client';

import { useInsumosFaltantes } from '@/lib/hooks/useInsumosFaltantes';
import { useComprasInsumos } from '@/lib/hooks/useComprasInsumos';
import { useState } from 'react';
import ModalRegistrarCompra from './ModalRegistrarCompra';

interface TarjetaInsumosFaltantesProps {
  expandido: boolean;
  minimizado?: boolean;
  onToggle: () => void;
}

export default function TarjetaInsumosFaltantes({ expandido, minimizado = false, onToggle }: TarjetaInsumosFaltantesProps) {
  const { insumosFaltantes, cargando, error, recargar } = useInsumosFaltantes();
  const [insumoExpandido, setInsumoExpandido] = useState<string | null>(null);
  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<any>(null);

  // Determinar el color de la tarjeta según la situación
  const getColorEstado = () => {
    if (cargando) return 'blue';
    if (error) return 'red';
    if (insumosFaltantes.length === 0) return 'green';
    
    // Verificar si todos están completos
    const todosCompletos = insumosFaltantes.every(i => i.cantidad_faltante === 0);
    if (todosCompletos) return 'green';
    
    // Verificar urgencia
    const faltantesUrgentes = insumosFaltantes.filter(i => i.cantidad_faltante > 0);
    if (faltantesUrgentes.length > 10) return 'red';
    if (faltantesUrgentes.length > 5) return 'orange';
    return 'yellow';
  };

  const getMensajeEstado = () => {
    if (cargando) return 'Calculando...';
    if (error) return 'Error al calcular';
    if (insumosFaltantes.length === 0) return '✅ No hay pedidos pendientes';
    
    const faltantes = insumosFaltantes.filter(i => i.cantidad_faltante > 0).length;
    if (faltantes === 0) return '✅ Todos los insumos completos';
    
    return `⚠️ ${faltantes} insumo${faltantes !== 1 ? 's' : ''} por comprar`;
  };

  const getEstadoInsumo = (insumo: any) => {
    if (insumo.porcentaje_completado === 0) return { emoji: '🔴', texto: 'Pendiente', color: '#ef4444' };
    if (insumo.porcentaje_completado === 100) return { emoji: '🟢', texto: 'Completo', color: '#10b981' };
    return { emoji: '🟡', texto: 'Parcial', color: '#f59e0b' };
  };

  const abrirModalCompra = (insumo: any) => {
    setInsumoSeleccionado(insumo);
    setModalCompraAbierto(true);
  };

  const cerrarModalCompra = () => {
    setModalCompraAbierto(false);
    setInsumoSeleccionado(null);
  };

  const handleCompraExitosa = () => {
    recargar();
  };

  const colorEstado = getColorEstado();

  // Vista minimizada (botón compacto)
  if (minimizado) {
    return (
      <div
        onClick={onToggle}
        className="tarjeta-minimizada"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '1rem',
          color: 'white',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.3s ease',
          minWidth: '80px',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.2)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        }}
      >
        <div style={{ fontSize: '2rem' }}>📋</div>
        <div style={{ 
          fontSize: '0.9rem', 
          fontWeight: 'bold', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <span className="texto-vertical">Insumos</span>
          {insumosFaltantes.length > 0 && (
            <span style={{
              background: 'rgba(251, 191, 36, 0.9)',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              marginTop: '0.25rem',
            }}>
              {insumosFaltantes.length}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`card card-insumos-faltantes ${expandido ? 'expandido' : ''}`}
        style={{ 
          gridColumn: '1 / -1',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: '4px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '200px',
        }}
      >
        {/* Header con ícono y badge arriba */}
        <div 
          onClick={onToggle}
          style={{
            cursor: 'pointer',
            padding: '1.5rem',
          }}
        >
          {/* Ícono y Badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}>
            <div 
              className="card-icon"
              style={{
                fontSize: '3rem',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '0.5rem',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              📋
            </div>
            
            <div 
              className={`badge badge-${colorEstado}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {getMensajeEstado()}
            </div>

            <div style={{ fontSize: '1.5rem' }}>
              {expandido ? '⬆️' : '⬇️'}
            </div>
          </div>

          {/* Título y descripción */}
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.6rem',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
            }}>
              Insumos Necesarios para Producción
            </h2>
            <p style={{ 
              margin: '0.5rem 0 0 0', 
              fontSize: '0.95rem',
              opacity: 0.9,
            }}>
              Basado en pedidos pendientes de entrega
            </p>
          </div>
        </div>

        {/* Botón Actualizar abajo centrado */}
        {!expandido && (
          <div style={{ 
            padding: '0 1.5rem 1.5rem 1.5rem',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                recargar();
              }}
              className="btn-actualizar-tarjeta"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '0.75rem 2rem',
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
              title="Actualizar"
            >
              <span className="btn-icon">🔄</span>
              <span className="btn-text"> Actualizar</span>
            </button>
          </div>
        )}

        {/* Contenido expandible */}
        {expandido && (
          <div 
            className="card-body-insumos"
            style={{
              padding: '1.5rem',
              background: 'rgba(255, 255, 255, 0.15)',
              borderTop: '2px solid rgba(255, 255, 255, 0.2)',
              maxHeight: '700px',
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

                <div className="tabla-insumos-faltantes" style={{
                  overflowX: 'auto',
                  maxWidth: '100%',
                  WebkitOverflowScrolling: 'touch',
                }}>
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
                        <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '1.1rem' }}>#</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '1.1rem' }}>Insumo</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>Necesario</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>Comprado</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>Faltante</th>
                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>Estado</th>
                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insumosFaltantes.map((insumo, index) => {
                        const estado = getEstadoInsumo(insumo);
                        return (
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
                            <td style={{ padding: '1rem' }}>
                              <div style={{ fontWeight: '600', fontSize: '1.05rem' }}>
                                {insumo.insumo_nombre}
                              </div>
                              <div style={{ fontSize: '0.85rem', opacity: 0.8, fontFamily: 'monospace' }}>
                                {insumo.insumo_codigo}
                              </div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: '500' }}>
                              {insumo.cantidad_necesaria.toFixed(2)} {insumo.presentacion_nombre}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: '500', color: '#a7f3d0' }}>
                              {insumo.cantidad_comprada.toFixed(2)} {insumo.presentacion_nombre}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '1.2rem', fontWeight: 'bold', color: insumo.cantidad_faltante > 0 ? '#fca5a5' : '#a7f3d0' }}>
                              {insumo.cantidad_faltante.toFixed(2)} {insumo.presentacion_nombre}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                fontSize: '0.95rem',
                                fontWeight: 'bold',
                              }}>
                                {estado.emoji} {estado.texto} ({insumo.porcentaje_completado}%)
                              </div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <button
                                onClick={() => abrirModalCompra(insumo)}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.25)',
                                  border: '2px solid rgba(255, 255, 255, 0.4)',
                                  color: 'white',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.95rem',
                                  fontWeight: 'bold',
                                  transition: 'all 0.2s',
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                              >
                                💰 Registrar Compra
                              </button>
                            </td>
                          </tr>
                        );
                      })}
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
            transform: scale(1.01);
          }
        `}</style>
      </div>

      {/* Modal de Registro de Compra */}
      {modalCompraAbierto && insumoSeleccionado && (
        <ModalRegistrarCompra
          insumo_id={insumoSeleccionado.insumo_id}
          insumo_nombre={insumoSeleccionado.insumo_nombre}
          presentacion_nombre={insumoSeleccionado.presentacion_nombre}
          cantidad_faltante={insumoSeleccionado.cantidad_faltante}
          onClose={cerrarModalCompra}
          onSuccess={handleCompraExitosa}
        />
      )}
    </>
  );
}

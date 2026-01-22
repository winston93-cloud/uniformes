'use client';

import { useState } from 'react';
import { useAlertasStock } from '@/lib/hooks/useAlertasStock';
import ModalRegistrarCompra from './ModalRegistrarCompra';

interface TarjetaAlertasStockProps {
  expandido: boolean;
  minimizado?: boolean;
  onToggle: () => void;
}

export default function TarjetaAlertasStock({ expandido, minimizado = false, onToggle }: TarjetaAlertasStockProps) {
  const { alertas, cargando, error, recargar, contadores } = useAlertasStock();
  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<any>(null);

  const abrirModalCompra = (alerta: any) => {
    setInsumoSeleccionado({
      insumo_id: alerta.insumo_id,
      insumo_nombre: alerta.insumo_nombre,
      insumo_codigo: alerta.insumo_codigo,
      cantidad_necesaria: alerta.stock_minimo - alerta.stock_actual,
      presentacion_nombre: alerta.presentacion_nombre,
    });
    setModalCompraAbierto(true);
  };

  const cerrarModalCompra = () => {
    setModalCompraAbierto(false);
    setInsumoSeleccionado(null);
    recargar(); // Recargar alertas después de registrar compra
  };

  // Determinar color y mensaje del badge principal
  const getBadgeInfo = () => {
    if (contadores.critico > 0) {
      return {
        color: 'danger',
        emoji: '🚨',
        texto: `${contadores.critico} ${contadores.critico === 1 ? 'Alerta Crítica' : 'Alertas Críticas'}`,
        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      };
    } else if (contadores.bajo > 0) {
      return {
        color: 'warning',
        emoji: '⚠️',
        texto: `${contadores.bajo} Stock Bajo`,
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      };
    } else if (contadores.advertencia > 0) {
      return {
        color: 'info',
        emoji: '📊',
        texto: `${contadores.advertencia} ${contadores.advertencia === 1 ? 'Advertencia' : 'Advertencias'}`,
        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
      };
    } else {
      return {
        color: 'success',
        emoji: '✅',
        texto: 'Stock OK',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      };
    }
  };

  const badgeInfo = getBadgeInfo();

  const getNivelColor = (nivel: string) => {
    switch (nivel) {
      case 'critico': return { bg: '#fee2e2', text: '#991b1b', emoji: '🚨' };
      case 'bajo': return { bg: '#fef3c7', text: '#92400e', emoji: '⚠️' };
      case 'advertencia': return { bg: '#dbeafe', text: '#1e3a8a', emoji: '📊' };
      default: return { bg: '#f3f4f6', text: '#374151', emoji: 'ℹ️' };
    }
  };

  // Vista minimizada (botón compacto)
  if (minimizado) {
    return (
      <div
        onClick={onToggle}
        className="tarjeta-minimizada"
        style={{
          background: badgeInfo.background,
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
        <div style={{ fontSize: '2rem' }}>📦</div>
        <div style={{ 
          fontSize: '0.9rem', 
          fontWeight: 'bold',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <span className="texto-vertical">Alertas</span>
          {contadores.critico > 0 && (
            <span style={{
              background: 'rgba(239, 68, 68, 0.9)',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              marginTop: '0.25rem',
            }}>
              {contadores.critico}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          background: badgeInfo.background,
          borderRadius: '16px',
          padding: '1.5rem',
          color: 'white',
          border: '4px solid rgba(255, 255, 255, 0.6)',
          transition: 'all 0.3s ease',
          boxShadow: expandido 
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.3)' 
            : '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          transform: expandido ? 'scale(1.02)' : 'scale(1)',
          height: '100%',
          minHeight: expandido ? 'auto' : '200px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div 
          onClick={onToggle}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '1rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              fontSize: '2.5rem',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              width: '60px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              📦
            </div>
            <div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '1.8rem',
                fontWeight: 'bold',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
              }}>
                Alertas de Stock Mínimo
              </h2>
              <p style={{ 
                margin: '0.5rem 0 0 0', 
                fontSize: '1rem',
                opacity: 0.9,
              }}>
                Control de stock de insumos en tiempo real
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div 
              className={`badge badge-${badgeInfo.color}`}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '20px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {badgeInfo.emoji} {badgeInfo.texto}
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

            <div style={{
              fontSize: '1.5rem',
              transition: 'transform 0.3s ease',
              transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              ⬇️
            </div>
          </div>
        </div>

        {/* Contenido expandible */}
        {expandido && (
          <div style={{ marginTop: '1rem' }}>
            {cargando && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
              }}>
                <div className="spinner" style={{
                  border: '4px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '4px solid white',
                  borderRadius: '50%',
                  width: '50px',
                  height: '50px',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem',
                }}></div>
                <p style={{ margin: 0, fontSize: '1.1rem' }}>
                  Analizando inventario...
                </p>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: '1.1rem' }}>
                  ❌ Error: {error}
                </p>
              </div>
            )}

            {!cargando && !error && alertas.length === 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                  ¡Inventario Saludable!
                </h3>
                <p style={{ margin: 0, fontSize: '1.1rem', opacity: 0.9 }}>
                  Todos los insumos están por encima del stock mínimo
                </p>
              </div>
            )}

            {!cargando && !error && alertas.length > 0 && (
              <div>
                {/* Resumen de alertas */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'space-around',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                      {contadores.critico}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                      🚨 Crítico
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                      {contadores.bajo}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                      ⚠️ Bajo
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                      {contadores.advertencia}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                      📊 Advertencia
                    </div>
                  </div>
                </div>

                {/* Tabla de alertas */}
                <div className="tabla-alertas-stock" style={{
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
                        <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '1.1rem' }}>Nivel</th>
                        <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '1.1rem' }}>Insumo</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>Stock Actual</th>
                        <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>Stock Mínimo</th>
                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>%</th>
                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertas.map((alerta, index) => {
                        const nivelStyle = getNivelColor(alerta.nivel_alerta);
                        return (
                          <tr 
                            key={alerta.insumo_id}
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
                            <td style={{ padding: '1rem' }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                background: nivelStyle.bg,
                                color: nivelStyle.text,
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                              }}>
                                {nivelStyle.emoji} {alerta.nivel_alerta.toUpperCase()}
                              </div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <div style={{ fontWeight: '600', fontSize: '1.05rem' }}>
                                {alerta.insumo_nombre}
                              </div>
                              <div style={{ fontSize: '0.85rem', opacity: 0.8, fontFamily: 'monospace' }}>
                                {alerta.insumo_codigo}
                              </div>
                            </td>
                            <td style={{ 
                              padding: '1rem', 
                              textAlign: 'right', 
                              fontSize: '1.1rem', 
                              fontWeight: 'bold',
                              color: alerta.porcentaje_stock < 25 ? '#fca5a5' : '#a7f3d0',
                            }}>
                              {alerta.stock_actual.toFixed(2)} {alerta.presentacion_nombre}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: '500' }}>
                              {alerta.stock_minimo.toFixed(2)} {alerta.presentacion_nombre}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                              }}>
                                {alerta.porcentaje_stock}%
                              </div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalCompra(alerta);
                                }}
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
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                                }}
                              >
                                💰 Comprar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Registro de Compra */}
      {modalCompraAbierto && insumoSeleccionado && (
        <ModalRegistrarCompra
          insumo_id={insumoSeleccionado.insumo_id}
          insumo_nombre={insumoSeleccionado.insumo_nombre}
          presentacion_nombre={insumoSeleccionado.presentacion_nombre}
          cantidad_faltante={insumoSeleccionado.cantidad_necesaria}
          onClose={cerrarModalCompra}
          onSuccess={recargar}
        />
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

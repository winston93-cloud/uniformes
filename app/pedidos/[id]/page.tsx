'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';

interface DetallePedido {
  id: string;
  prenda_id: string;
  talla_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  pendiente: number;
  especificaciones: string | null;
  prenda: { nombre: string };
  talla: { nombre: string };
}

interface Pedido {
  id: string;
  tipo_cliente: string;
  cliente_nombre: string;
  estado: string;
  subtotal: number;
  total: number;
  notas: string | null;
  created_at: string;
  alumno_id: string | null;
  externo_id: string | null;
  sucursal: {
    nombre: string;
    direccion: string | null;
    telefono: string | null;
  };
  alumno?: {
    nivel: string | null;
    grado: string | null;
  } | null;
  detalles: DetallePedido[];
}

export default function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { sesion } = useAuth();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  const [movimientos, setMovimientos] = useState<any[]>([]);

  useEffect(() => {
    cargarPedido();
  }, [resolvedParams.id]);

  const cargarPedido = async () => {
    try {
      setLoading(true);
      
      // Obtener pedido con sucursal y datos del alumno si aplica
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          *,
          sucursal:sucursales(nombre, direccion, telefono),
          alumno:alumnos(nivel, grado)
        `)
        .eq('id', resolvedParams.id)
        .single();

      if (pedidoError) throw pedidoError;

      // Obtener detalles con nombres de prendas y tallas
      const { data: detallesData, error: detallesError } = await supabase
        .from('detalle_pedidos')
        .select(`
          *,
          prenda:prendas(nombre),
          talla:tallas(nombre)
        `)
        .eq('pedido_id', resolvedParams.id)
        .order('created_at', { ascending: true });

      if (detallesError) throw detallesError;

      // Obtener movimientos de inventario relacionados con este pedido
      const { data: movimientosData } = await supabase
        .from('movimientos')
        .select(`
          *,
          costo:costos(
            prenda:prendas(nombre),
            talla:tallas(nombre)
          )
        `)
        .ilike('observaciones', `%Pedido #${resolvedParams.id}%`)
        .order('created_at', { ascending: true });

      setMovimientos(movimientosData || []);

      setPedido({
        ...pedidoData,
        detalles: detallesData || []
      });
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      alert('Error al cargar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const imprimirRecibo = () => {
    window.print();
  };

  if (loading) {
    return (
      <LayoutWrapper>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Cargando pedido...</p>
        </div>
      </LayoutWrapper>
    );
  }

  if (!pedido) {
    return (
      <LayoutWrapper>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No se encontró el pedido</p>
          <button onClick={() => router.push('/pedidos')}>Volver a Pedidos</button>
        </div>
      </LayoutWrapper>
    );
  }

  const cantidadEntregada = (detalle: DetallePedido) => detalle.cantidad - detalle.pendiente;
  const tienePendientes = pedido.detalles.some(d => d.pendiente > 0);
  
  // Calcular totales de entregadas y pendientes
  const totalPartidas = pedido.detalles.length;
  const partidasEntregadasCompletas = pedido.detalles.filter(d => d.pendiente === 0).length;
  const partidasConPendientes = pedido.detalles.filter(d => d.pendiente > 0).length;
  const totalUnidadesEntregadas = pedido.detalles.reduce((sum, d) => sum + cantidadEntregada(d), 0);
  const totalUnidadesPendientes = pedido.detalles.reduce((sum, d) => sum + d.pendiente, 0);

  return (
    <LayoutWrapper>
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5cm;
          }
          body * {
            visibility: hidden;
          }
          #recibo-impresion, #recibo-impresion * {
            visibility: visible;
          }
          #recibo-impresion {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
          }
          .no-imprimir {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {/* Botones de acción */}
        <div className="no-imprimir" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => router.push('/pedidos')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ← Volver
          </button>
          <button
            onClick={imprimirRecibo}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🖨️ Imprimir Recibo
          </button>
        </div>

        {/* Recibo */}
        <div 
          id="recibo-impresion"
          style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}
        >
          {/* Encabezado */}
          <div style={{ textAlign: 'center', marginBottom: '0.75rem', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>
            <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: '700' }}>
              {pedido.sucursal.nombre}
            </h1>
            {pedido.sucursal.direccion && (
              <p style={{ margin: '0.1rem 0', fontSize: '0.7rem' }}>{pedido.sucursal.direccion}</p>
            )}
            {pedido.sucursal.telefono && (
              <p style={{ margin: '0.1rem 0', fontSize: '0.7rem' }}>Tel: {pedido.sucursal.telefono}</p>
            )}
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', fontWeight: '700' }}>
              TICKET DE VENTA
            </p>
          </div>

          {/* Información del pedido */}
          <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span><strong>Folio:</strong></span>
              <span>#{pedido.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span><strong>Fecha:</strong></span>
              <span>{new Date(pedido.created_at).toLocaleString('es-MX')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span><strong>Alumno/Externo:</strong></span>
              <span>
                {pedido.cliente_nombre}
                {pedido.tipo_cliente === 'ALUMNO' && pedido.alumno && (
                  <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                    ({pedido.alumno.nivel || ''} {pedido.alumno.grado || ''})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Estado detallado del pedido */}
          <div style={{
            backgroundColor: pedido.estado === 'ENTREGADO' ? '#d1fae5' : '#fef3c7',
            border: `1px solid ${pedido.estado === 'ENTREGADO' ? '#10b981' : '#f59e0b'}`,
            borderRadius: '4px',
            padding: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            <div style={{ 
              fontSize: '0.8rem', 
              fontWeight: '700',
              marginBottom: '0.35rem',
              color: pedido.estado === 'ENTREGADO' ? '#065f46' : '#92400e',
              textAlign: 'center'
            }}>
              {pedido.estado === 'ENTREGADO' ? '✅ PEDIDO ENTREGADO COMPLETO' : '⚠️ PEDIDO CON PENDIENTES'}
            </div>
            
            <div style={{ 
              fontSize: '0.65rem', 
              color: '#374151',
              borderTop: `1px dashed ${pedido.estado === 'ENTREGADO' ? '#10b981' : '#f59e0b'}`,
              paddingTop: '0.35rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.25rem'
            }}>
              <div>
                <strong>Partidas:</strong> {totalPartidas}
              </div>
              <div>
                <strong>Entregadas:</strong> <span style={{ color: '#10b981', fontWeight: '700' }}>{totalUnidadesEntregadas}</span>
              </div>
              {tienePendientes && (
                <>
                  <div>
                    <strong>Completas:</strong> {partidasEntregadasCompletas}
                  </div>
                  <div>
                    <strong>Pendientes:</strong> <span style={{ color: '#dc2626', fontWeight: '700' }}>{totalUnidadesPendientes}</span>
                  </div>
                </>
              )}
            </div>
            
            {pedido.estado === 'ENTREGADO' && (
              <div style={{ 
                marginTop: '0.35rem', 
                fontSize: '0.6rem', 
                fontStyle: 'italic',
                color: '#065f46',
                textAlign: 'center'
              }}>
                Todas las prendas entregadas. Pedido completado.
              </div>
            )}
            {tienePendientes && (
              <div style={{ 
                marginTop: '0.35rem', 
                fontSize: '0.6rem', 
                fontWeight: '600',
                color: '#92400e',
                textAlign: 'center'
              }}>
                {totalUnidadesEntregadas} entregadas. {totalUnidadesPendientes} pendientes.
              </div>
            )}
          </div>

          {/* Detalles del pedido */}
          <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '0.5rem 0', marginBottom: '0.5rem' }}>
            <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #666' }}>
                  <th style={{ textAlign: 'left', padding: '0.25rem 0', fontWeight: '700', fontSize: '0.65rem' }}>ARTÍCULO</th>
                  <th style={{ textAlign: 'center', padding: '0.25rem', fontWeight: '700', width: '35px', fontSize: '0.65rem' }}>✅</th>
                  <th style={{ textAlign: 'center', padding: '0.25rem', fontWeight: '700', width: '35px', fontSize: '0.65rem' }}>⚠️</th>
                  <th style={{ textAlign: 'right', padding: '0.25rem 0', fontWeight: '700', fontSize: '0.65rem' }}>PRECIO</th>
                  <th style={{ textAlign: 'right', padding: '0.25rem 0', fontWeight: '700', fontSize: '0.65rem' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {pedido.detalles.map((detalle, index) => {
                  const entregado = cantidadEntregada(detalle);
                  const pendiente = detalle.pendiente;
                  
                  return (
                    <tr key={detalle.id} style={{ 
                      borderBottom: index < pedido.detalles.length - 1 ? '1px dashed #e0e0e0' : 'none',
                      backgroundColor: pendiente > 0 ? '#fffbeb' : 'transparent'
                    }}>
                      <td style={{ padding: '0.4rem 0' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.7rem' }}>{detalle.prenda.nombre}</div>
                          <div style={{ fontSize: '0.6rem', color: '#666' }}>
                            Talla: {detalle.talla.nombre}
                          </div>
                          {detalle.especificaciones && (
                            <div style={{ fontSize: '0.6rem', color: '#666', fontStyle: 'italic' }}>
                              {detalle.especificaciones}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '0.4rem 0.25rem', 
                        fontWeight: '700',
                        color: '#10b981',
                        fontSize: '0.75rem'
                      }}>
                        {entregado}
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '0.4rem 0.25rem', 
                        fontWeight: '700',
                        color: pendiente > 0 ? '#dc2626' : '#9ca3af',
                        fontSize: '0.75rem'
                      }}>
                        {pendiente}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0', fontSize: '0.7rem' }}>
                        ${detalle.precio_unitario.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0', fontWeight: '600', fontSize: '0.7rem' }}>
                        ${detalle.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
              <span><strong>SUBTOTAL:</strong></span>
              <span>${pedido.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '0.9rem', 
              fontWeight: '700',
              borderTop: '2px solid #000',
              paddingTop: '0.25rem'
            }}>
              <span>TOTAL:</span>
              <span>${pedido.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Movimientos de inventario */}
          {movimientos.length > 0 && (
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              padding: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <h3 style={{ 
                margin: '0 0 0.35rem 0', 
                fontSize: '0.7rem', 
                fontWeight: '700',
                color: '#1e40af',
                borderBottom: '1px solid #3b82f6',
                paddingBottom: '0.25rem'
              }}>
                📦 MOVIMIENTOS DE INVENTARIO
              </h3>
              {movimientos.map((mov, idx) => (
                <div key={mov.id} style={{ 
                  fontSize: '0.65rem',
                  marginBottom: idx < movimientos.length - 1 ? '0.3rem' : 0,
                  paddingBottom: idx < movimientos.length - 1 ? '0.3rem' : 0,
                  borderBottom: idx < movimientos.length - 1 ? '1px dashed #bfdbfe' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                    <span style={{ fontWeight: '600' }}>
                      {mov.costo?.prenda?.nombre || 'Prenda'} - {mov.costo?.talla?.nombre || 'Talla'}
                    </span>
                    <span style={{ 
                      fontWeight: '700',
                      color: mov.tipo === 'SALIDA' ? '#dc2626' : '#10b981'
                    }}>
                      {mov.tipo}: {Math.abs(mov.cantidad)}
                    </span>
                  </div>
                  {mov.observaciones && (
                    <div style={{ fontSize: '0.6rem', color: '#6b7280', fontStyle: 'italic' }}>
                      {mov.observaciones}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Advertencia de pendientes */}
          {tienePendientes && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #dc2626',
              borderRadius: '4px',
              padding: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <p style={{ margin: '0 0 0.35rem 0', color: '#991b1b', fontWeight: '700', textAlign: 'center', fontSize: '0.7rem' }}>
                ⚠️ ARTÍCULOS PENDIENTES DE ENTREGA
              </p>
              <div style={{ marginTop: '0.35rem', fontSize: '0.65rem' }}>
                {pedido.detalles.filter(d => d.pendiente > 0).map(d => (
                  <div key={d.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '0.3rem',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    borderRadius: '3px',
                    marginBottom: '0.3rem'
                  }}>
                    <span style={{ color: '#991b1b', fontWeight: '600' }}>
                      {d.prenda.nombre} - {d.talla.nombre}
                    </span>
                    <span style={{ color: '#dc2626', fontWeight: '700' }}>
                      {d.pendiente} pend.
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '0.35rem 0 0 0', color: '#991b1b', fontSize: '0.65rem', textAlign: 'center', fontWeight: '600' }}>
                Favor de pasar a recoger cuando estén disponibles
              </p>
            </div>
          )}

          {/* Notas */}
          {pedido.notas && (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.65rem' }}>
              <strong>NOTAS:</strong>
              <p style={{ margin: '0.25rem 0', fontStyle: 'italic' }}>{pedido.notas}</p>
            </div>
          )}

          {/* Pie de página */}
          <div style={{ 
            borderTop: '2px solid #000', 
            paddingTop: '0.5rem', 
            textAlign: 'center',
            fontSize: '0.65rem'
          }}>
            <p style={{ margin: '0.15rem 0' }}>¡GRACIAS POR SU COMPRA!</p>
            <p style={{ margin: '0.15rem 0', fontSize: '0.6rem', color: '#666' }}>
              Sistema de Gestión de Uniformes
            </p>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}

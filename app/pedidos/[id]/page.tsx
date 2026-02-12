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
  sucursal: {
    nombre: string;
    direccion: string | null;
    telefono: string | null;
  };
  detalles: DetallePedido[];
}

export default function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { sesion } = useAuth();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarPedido();
  }, [resolvedParams.id]);

  const cargarPedido = async () => {
    try {
      setLoading(true);
      
      // Obtener pedido con sucursal
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          *,
          sucursal:sucursales(nombre, direccion, telefono)
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

  return (
    <LayoutWrapper>
      <style jsx global>{`
        @media print {
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
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily: 'monospace'
          }}
        >
          {/* Encabezado */}
          <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: '700' }}>
              {pedido.sucursal.nombre}
            </h1>
            {pedido.sucursal.direccion && (
              <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>{pedido.sucursal.direccion}</p>
            )}
            {pedido.sucursal.telefono && (
              <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Tel: {pedido.sucursal.telefono}</p>
            )}
            <p style={{ margin: '0.75rem 0 0 0', fontSize: '1.1rem', fontWeight: '700' }}>
              TICKET DE VENTA
            </p>
          </div>

          {/* Información del pedido */}
          <div style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span><strong>Folio:</strong></span>
              <span>#{pedido.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span><strong>Fecha:</strong></span>
              <span>{new Date(pedido.created_at).toLocaleString('es-MX')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span><strong>Cliente:</strong></span>
              <span>{pedido.cliente_nombre}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span><strong>Estado:</strong></span>
              <span style={{ 
                fontWeight: '700',
                color: pedido.estado === 'ENTREGADO' ? '#10b981' : 
                       pedido.estado === 'PEDIDO' ? '#f59e0b' : '#6b7280'
              }}>
                {pedido.estado}
              </span>
            </div>
          </div>

          {/* Detalles del pedido */}
          <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '1rem 0', marginBottom: '1rem' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #666' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0', fontWeight: '700' }}>ARTÍCULO</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0', fontWeight: '700' }}>CANT</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem 0', fontWeight: '700' }}>PRECIO</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem 0', fontWeight: '700' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {pedido.detalles.map((detalle, index) => {
                  const entregado = cantidadEntregada(detalle);
                  const pendiente = detalle.pendiente;
                  
                  return (
                    <tr key={detalle.id} style={{ borderBottom: index < pedido.detalles.length - 1 ? '1px dashed #e0e0e0' : 'none' }}>
                      <td style={{ padding: '0.75rem 0' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{detalle.prenda.nombre}</div>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            Talla: {detalle.talla.nombre}
                          </div>
                          {detalle.especificaciones && (
                            <div style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
                              {detalle.especificaciones}
                            </div>
                          )}
                          {pendiente > 0 && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#dc2626', 
                              fontWeight: '700',
                              marginTop: '0.25rem',
                              backgroundColor: '#fee2e2',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '4px',
                              display: 'inline-block'
                            }}>
                              ⚠️ {entregado} entregadas, {pendiente} pendientes
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.75rem 0', fontWeight: '600' }}>
                        {detalle.cantidad}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem 0' }}>
                        ${detalle.precio_unitario.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem 0', fontWeight: '600' }}>
                        ${detalle.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1rem' }}>
              <span><strong>SUBTOTAL:</strong></span>
              <span>${pedido.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '1.3rem', 
              fontWeight: '700',
              borderTop: '2px solid #000',
              paddingTop: '0.5rem'
            }}>
              <span>TOTAL:</span>
              <span>${pedido.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Advertencia de pendientes */}
          {tienePendientes && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '2px solid #dc2626',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{ margin: 0, color: '#991b1b', fontWeight: '700', textAlign: 'center' }}>
                ⚠️ ESTE PEDIDO TIENE PARTIDAS PENDIENTES DE ENTREGA
              </p>
              <p style={{ margin: '0.5rem 0 0 0', color: '#991b1b', fontSize: '0.85rem', textAlign: 'center' }}>
                Favor de pasar a recoger cuando estén disponibles
              </p>
            </div>
          )}

          {/* Notas */}
          {pedido.notas && (
            <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <strong>NOTAS:</strong>
              <p style={{ margin: '0.5rem 0', fontStyle: 'italic' }}>{pedido.notas}</p>
            </div>
          )}

          {/* Pie de página */}
          <div style={{ 
            borderTop: '2px solid #000', 
            paddingTop: '1rem', 
            textAlign: 'center',
            fontSize: '0.8rem'
          }}>
            <p style={{ margin: '0.25rem 0' }}>¡GRACIAS POR SU COMPRA!</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#666' }}>
              Sistema de Gestión de Uniformes
            </p>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}

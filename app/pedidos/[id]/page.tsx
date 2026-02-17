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
      
      // Obtener pedido con sucursal
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          *,
          sucursales(nombre, direccion, telefono)
        `)
        .eq('id', resolvedParams.id)
        .single();

      if (pedidoError) {
        console.error('Error al cargar pedido:', pedidoError);
        throw pedidoError;
      }

      // Si hay alumno_id, obtener sus datos
      let alumnoData = null;
      if (pedidoData.alumno_id) {
        const { data: alumno } = await supabase
          .from('alumnos')
          .select('nivel, grado')
          .eq('alumno_id', pedidoData.alumno_id)
          .single();
        alumnoData = alumno;
      }

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
        sucursal: pedidoData.sucursales || pedidoData.sucursal,
        alumno: alumnoData,
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
            margin: 0.3cm;
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
            transform: scale(0.85);
            transform-origin: top left;
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
            padding: '0.5rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}
        >
          {/* Encabezado */}
          <div style={{ textAlign: 'center', marginBottom: '0.4rem', borderBottom: '1px solid #000', paddingBottom: '0.3rem' }}>
            <h1 style={{ margin: '0 0 0.15rem 0', fontSize: '0.85rem', fontWeight: '700' }}>
              {pedido.sucursal.nombre}
            </h1>
            {pedido.sucursal.direccion && (
              <p style={{ margin: '0.05rem 0', fontSize: '0.55rem' }}>{pedido.sucursal.direccion}</p>
            )}
            {pedido.sucursal.telefono && (
              <p style={{ margin: '0.05rem 0', fontSize: '0.55rem' }}>Tel: {pedido.sucursal.telefono}</p>
            )}
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.65rem', fontWeight: '700' }}>
              TICKET DE VENTA
            </p>
          </div>

          {/* Información del pedido */}
          <div style={{ marginBottom: '0.4rem', fontSize: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
              <span><strong>Folio:</strong></span>
              <span>#{pedido.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
              <span><strong>Fecha:</strong></span>
              <span>{new Date(pedido.created_at).toLocaleString('es-MX')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
              <span><strong>Cliente:</strong></span>
              <span>
                {pedido.cliente_nombre}
                {pedido.tipo_cliente === 'ALUMNO' && pedido.alumno && (
                  <span style={{ marginLeft: '0.3rem', color: '#6b7280', fontSize: '0.55rem' }}>
                    ({pedido.alumno.nivel || ''} {pedido.alumno.grado || ''})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Estado detallado del pedido */}
          <div style={{
            backgroundColor: pedido.estado === 'COMPLETADO' ? '#d1fae5' : '#fef3c7',
            border: `1px solid ${pedido.estado === 'COMPLETADO' ? '#10b981' : '#f59e0b'}`,
            borderRadius: '3px',
            padding: '0.3rem',
            marginBottom: '0.4rem'
          }}>
            <div style={{ 
              fontSize: '0.6rem', 
              fontWeight: '700',
              marginBottom: '0.2rem',
              color: pedido.estado === 'COMPLETADO' ? '#065f46' : '#92400e',
              textAlign: 'center'
            }}>
              {pedido.estado === 'COMPLETADO' ? '✅ COMPLETADO' : '⚠️ PENDIENTE'}
            </div>
            
            <div style={{ 
              fontSize: '0.5rem', 
              color: '#374151',
              borderTop: `1px dashed ${pedido.estado === 'COMPLETADO' ? '#10b981' : '#f59e0b'}`,
              paddingTop: '0.2rem',
              display: 'flex',
              justifyContent: 'space-around',
              gap: '0.2rem'
            }}>
              <span><strong>Partidas:</strong> {totalPartidas}</span>
              <span><strong>Entregadas:</strong> <span style={{ color: '#10b981', fontWeight: '700' }}>{totalUnidadesEntregadas}</span></span>
              {tienePendientes && (
                <span><strong>Pendientes:</strong> <span style={{ color: '#dc2626', fontWeight: '700' }}>{totalUnidadesPendientes}</span></span>
              )}
            </div>
          </div>

          {/* Detalles del pedido */}
          <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '0.3rem 0', marginBottom: '0.3rem' }}>
            <table style={{ width: '100%', fontSize: '0.55rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #666' }}>
                  <th style={{ textAlign: 'left', padding: '0.15rem 0', fontWeight: '700', fontSize: '0.5rem' }}>ARTÍCULO</th>
                  <th style={{ textAlign: 'center', padding: '0.15rem', fontWeight: '700', width: '25px', fontSize: '0.5rem' }}>✅</th>
                  <th style={{ textAlign: 'center', padding: '0.15rem', fontWeight: '700', width: '25px', fontSize: '0.5rem' }}>⚠️</th>
                  <th style={{ textAlign: 'right', padding: '0.15rem 0', fontWeight: '700', fontSize: '0.5rem' }}>PRECIO</th>
                  <th style={{ textAlign: 'right', padding: '0.15rem 0', fontWeight: '700', fontSize: '0.5rem' }}>TOTAL</th>
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
                      <td style={{ padding: '0.25rem 0' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.55rem' }}>{detalle.prenda.nombre}</div>
                          <div style={{ fontSize: '0.5rem', color: '#666' }}>
                            {detalle.talla.nombre}{detalle.especificaciones ? ` - ${detalle.especificaciones}` : ''}
                          </div>
                        </div>
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '0.25rem 0.15rem', 
                        fontWeight: '700',
                        color: '#10b981',
                        fontSize: '0.6rem'
                      }}>
                        {entregado}
                      </td>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '0.25rem 0.15rem', 
                        fontWeight: '700',
                        color: pendiente > 0 ? '#dc2626' : '#9ca3af',
                        fontSize: '0.6rem'
                      }}>
                        {pendiente}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.25rem 0', fontSize: '0.55rem' }}>
                        ${detalle.precio_unitario.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.25rem 0', fontWeight: '600', fontSize: '0.55rem' }}>
                        ${detalle.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div style={{ marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem', fontSize: '0.6rem' }}>
              <span><strong>SUBTOTAL:</strong></span>
              <span>${pedido.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '0.7rem', 
              fontWeight: '700',
              borderTop: '1px solid #000',
              paddingTop: '0.15rem'
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
              borderRadius: '3px',
              padding: '0.3rem',
              marginBottom: '0.4rem'
            }}>
              <h3 style={{ 
                margin: '0 0 0.2rem 0', 
                fontSize: '0.55rem', 
                fontWeight: '700',
                color: '#1e40af',
                borderBottom: '1px solid #3b82f6',
                paddingBottom: '0.15rem'
              }}>
                📦 MOVIMIENTOS
              </h3>
              {movimientos.map((mov, idx) => (
                <div key={mov.id} style={{ 
                  fontSize: '0.5rem',
                  marginBottom: idx < movimientos.length - 1 ? '0.2rem' : 0,
                  paddingBottom: idx < movimientos.length - 1 ? '0.2rem' : 0,
                  borderBottom: idx < movimientos.length - 1 ? '1px dashed #bfdbfe' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                </div>
              ))}
            </div>
          )}

          {/* Advertencia de pendientes */}
          {tienePendientes && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #dc2626',
              borderRadius: '3px',
              padding: '0.3rem',
              marginBottom: '0.4rem'
            }}>
              <p style={{ margin: '0 0 0.2rem 0', color: '#991b1b', fontWeight: '700', textAlign: 'center', fontSize: '0.55rem' }}>
                ⚠️ PENDIENTES DE ENTREGA
              </p>
              <div style={{ marginTop: '0.2rem', fontSize: '0.5rem' }}>
                {pedido.detalles.filter(d => d.pendiente > 0).map(d => (
                  <div key={d.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '0.2rem',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    borderRadius: '2px',
                    marginBottom: '0.2rem'
                  }}>
                    <span style={{ color: '#991b1b', fontWeight: '600' }}>
                      {d.prenda.nombre} - {d.talla.nombre}
                    </span>
                    <span style={{ color: '#dc2626', fontWeight: '700' }}>
                      {d.pendiente}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '0.2rem 0 0 0', color: '#991b1b', fontSize: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
                Pasar a recoger cuando estén disponibles
              </p>
            </div>
          )}

          {/* Notas */}
          {pedido.notas && (
            <div style={{ marginBottom: '0.4rem', fontSize: '0.5rem' }}>
              <strong>NOTAS:</strong>
              <p style={{ margin: '0.15rem 0', fontStyle: 'italic' }}>{pedido.notas}</p>
            </div>
          )}

          {/* Pie de página */}
          <div style={{ 
            borderTop: '1px solid #000', 
            paddingTop: '0.3rem', 
            textAlign: 'center',
            fontSize: '0.5rem'
          }}>
            <p style={{ margin: '0.1rem 0' }}>¡GRACIAS POR SU COMPRA!</p>
            <p style={{ margin: '0.1rem 0', fontSize: '0.45rem', color: '#666' }}>
              Sistema de Gestión de Uniformes
            </p>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}

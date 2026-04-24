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
  folio?: string | null;
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
            size: 216mm 93mm;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 216mm !important;
            height: 90mm !important;
            overflow: hidden !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Evita que el resto del DOM reserve espacio y cree una "página 2" */
          body > *:not(#recibo-impresion) {
            display: none !important;
          }
          #recibo-impresion {
            position: absolute;
            left: 0;
            top: 0;
            width: 216mm;
            max-width: 216mm;
            max-height: 90mm;
            height: auto !important;
            box-sizing: border-box;
            padding-top: 1.5rem !important;
            padding-bottom: 0 !important;
            font-size: 0.71rem !important;
            transform: scale(0.98) !important;
            transform-origin: top left !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          #recibo-impresion p {
            margin-bottom: 0 !important;
          }
          .recibo-scale-wrap {
            transform: none !important;
            padding-bottom: 0 !important;
            margin: 0 !important;
          }
          .no-imprimir {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '990px', margin: '0 auto', padding: '2rem 2.5rem' }}>
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

        {/* Recibo: +30% en pantalla (zoom); al imprimir se anula el escalado del wrap */}
        <div
          className="recibo-scale-wrap"
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: '3rem',
            transform: 'scale(1.3)',
            transformOrigin: 'top center',
          }}
        >
        <div 
          id="recibo-impresion"
          style={{
            backgroundColor: 'white',
            padding: '0.4rem 0.55rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
            fontSize: '0.71rem',
            width: '100%',
            maxWidth: '828px',
            margin: '0 auto'
          }}
        >
          {/* Header distribuido */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '0.75rem',
              paddingBottom: '0.25rem',
              borderBottom: '1px solid #0f172a',
              marginBottom: '0.3rem',
            }}
          >
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.1 }}>
                Matriz Madero
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginTop: '0.15rem' }}>
                Ticket de venta
              </div>
            </div>

            <div style={{ flex: 1, textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.25, paddingRight: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.6rem' }}>
                <span>
                  <strong>Folio:</strong> {pedido.folio || `#${pedido.id.slice(0, 8).toUpperCase()}`}
                </span>
                <span>
                  <strong>Fecha:</strong> {new Date(pedido.created_at).toLocaleString('es-MX')}
                </span>
                <span style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>Cliente:</strong> {pedido.cliente_nombre}
                </span>
              </div>
              {pedido.tipo_cliente === 'ALUMNO' && pedido.alumno && (
                <div style={{ marginTop: '0.15rem', color: '#64748b', fontSize: '0.68rem' }}>
                  {pedido.alumno.nivel || ''} {pedido.alumno.grado || ''}
                </div>
              )}
            </div>
          </div>

          {/* Detalles del pedido */}
          <div style={{ borderTop: '1px solid #0f172a', borderBottom: '1px solid #0f172a', padding: '0.2rem 0', marginBottom: '0.2rem', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <table style={{ width: '100%', fontSize: '0.65rem', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #64748b' }}>
                  <th style={{ textAlign: 'left', padding: '0.2rem 0', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.02em' }}>ARTÍCULO</th>
                  <th style={{ textAlign: 'center', padding: '0.2rem 0.25rem', fontWeight: 900, width: 56, fontSize: '0.65rem' }}>CANT</th>
                  <th style={{ textAlign: 'right', padding: '0.2rem 0', fontWeight: 900, width: 90, fontSize: '0.65rem' }}>PRECIO</th>
                  <th style={{ textAlign: 'right', padding: '0.2rem 0', fontWeight: 900, width: 96, fontSize: '0.65rem' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {pedido.detalles.map((detalle, index) => {
                  const cant = Number(detalle.cantidad) || 0;
                  
                  return (
                    <tr key={detalle.id} style={{ 
                      borderBottom: index < pedido.detalles.length - 1 ? '1px dashed #e2e8f0' : 'none',
                    }}>
                      <td style={{ padding: '0.125rem 0', overflow: 'hidden' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {detalle.prenda.nombre}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {detalle.talla.nombre}{detalle.especificaciones ? ` - ${detalle.especificaciones}` : ''}
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.125rem 0.2rem', fontWeight: 800 }}>
                        {cant}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.125rem 0', fontVariantNumeric: 'tabular-nums' }}>
                        ${detalle.precio_unitario.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.125rem 0', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                        ${detalle.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div style={{ marginBottom: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem', fontSize: '0.57rem' }}>
              <span><strong>SUBTOTAL:</strong></span>
              <span>${pedido.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '0.66rem', 
              fontWeight: '700',
              borderTop: '1px solid #000',
              paddingTop: '0.1rem'
            }}>
              <span>TOTAL:</span>
              <span>${pedido.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Nuevo bloque de estatus (debajo del total) */}
          <div
            style={{
              borderTop: '1px dashed #94a3b8',
              paddingTop: '0.2rem',
              marginBottom: '0.25rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.25rem 0.75rem',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontWeight: 900 }}>Partidas Entregadas</span>
              <span style={{ fontWeight: 900, color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
                {partidasEntregadasCompletas}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontWeight: 900 }}>Partidas Pendientes</span>
              <span style={{ fontWeight: 900, color: partidasConPendientes > 0 ? '#b91c1c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                {partidasConPendientes}
              </span>
            </div>
          </div>

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
            paddingTop: '0.2rem', 
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
      </div>
    </LayoutWrapper>
  );
}

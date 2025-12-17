'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LayoutWrapper from '@/components/LayoutWrapper';
import { supabase } from '@/lib/supabase';

interface DetallePedido {
  prenda: string;
  talla: string;
  cantidad: number;
  pendiente: number;
  precio_unitario: number;
  subtotal: number;
  especificaciones?: string;
}

interface Pedido {
  id: string;
  cliente_nombre: string;
  tipo_cliente: string;
  fecha: string;
  total: number;
  subtotal: number;
  estado: string;
  notas?: string;
  modalidad_pago?: string;
  efectivo_recibido?: number;
  detalles: DetallePedido[];
}

export default function DetallePedidoPage() {
  const router = useRouter();
  const params = useParams();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  // Estilos para impresión
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        /* Ocultar elementos innecesarios */
        nav, aside, .no-print, button, header, footer {
          display: none !important;
        }

        /* Ocultar footer del navegador (URL y número de página) */
        @page {
          margin: 0;
        }

        /* Reset de márgenes y padding */
        body {
          margin: 0;
          padding: 0;
          background: white;
        }

        /* Contenedor principal */
        .print-container {
          max-width: 100%;
          margin: 0;
          padding: 8px 12px;
        }

        /* Encabezado del recibo */
        .print-header {
          text-align: center !important;
          border-bottom: 1px solid #1f2937 !important;
          padding-bottom: 2px !important;
          margin-bottom: 4px !important;
        }

        .print-header h1 {
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #1f2937 !important;
          margin: 0 !important;
          letter-spacing: 0.3px !important;
        }

        .print-header .subtitle {
          font-size: 7px !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2px !important;
          margin: 1px 0 0 0 !important;
        }

        /* Información del pedido */
        .print-info {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 3px !important;
          margin-bottom: 4px !important;
          padding: 3px 4px !important;
          background: #f9fafb !important;
          border-radius: 2px !important;
          border: 1px solid #e5e7eb !important;
        }

        .print-info-item {
          text-align: center !important;
        }

        .print-info-label {
          font-size: 6px !important;
          color: #6b7280 !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          margin-bottom: 1px !important;
          letter-spacing: 0.1px !important;
        }

        .print-info-value {
          font-size: 8px !important;
          font-weight: 700 !important;
          color: #1f2937 !important;
        }
        
        .print-info * {
          font-size: inherit !important;
        }

        /* Sobrescribir estilos inline específicos */
        .print-info p {
          font-size: 8px !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .print-info-label[style] {
          font-size: 6px !important;
        }

        .print-info-value[style] {
          font-size: 8px !important;
        }

        /* Tabla de productos */
        .print-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-bottom: 6px !important;
          font-size: 8px !important;
        }

        .print-table thead {
          background: #1f2937 !important;
          color: white !important;
        }

        .print-table th {
          padding: 3px 2px !important;
          text-align: left !important;
          font-size: 7px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2px !important;
        }

        .print-table tbody tr {
          border-bottom: 1px solid #e5e7eb !important;
        }

        .print-table tbody tr:last-child {
          border-bottom: 1px solid #1f2937 !important;
        }

        .print-table td {
          padding: 3px 2px !important;
          font-size: 8px !important;
        }

        .print-table .product-name {
          font-weight: 600 !important;
          color: #1f2937 !important;
          font-size: 8px !important;
        }

        .print-table .size-badge {
          display: inline-block !important;
          background: #3b82f6 !important;
          color: white !important;
          padding: 1px 4px !important;
          border-radius: 2px !important;
          font-weight: 600 !important;
          font-size: 7px !important;
        }

        .print-table .price {
          text-align: right !important;
          font-weight: 600 !important;
          font-size: 8px !important;
        }

        .print-table .total-cell {
          font-weight: 700 !important;
          color: #10b981 !important;
          font-size: 8px !important;
        }

        /* Resumen y observaciones */
        .print-footer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 10px;
        }

        .print-observations {
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 2px;
          padding: 3px 5px;
        }

        .print-observations-title {
          font-size: 7px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 1px;
          text-transform: uppercase;
        }

        .print-observations-text {
          font-size: 7px;
          color: #92400e;
          font-style: italic;
          line-height: 1.1;
        }

        .print-summary {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .print-summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 6px;
          border-radius: 2px;
          font-size: 8px;
        }

        .print-summary-total {
          background: #1f2937;
          color: white;
          font-weight: 700;
          font-size: 9px;
        }

        .print-summary-anticipo,
        .print-summary-restante {
          background: #f3f4f6;
          color: #1f2937;
          font-weight: 600;
          font-size: 8px;
        }

        /* Footer del documento - OCULTO */
        .print-document-footer {
          display: none !important;
        }

        /* Salto de página si es necesario */
        .page-break {
          page-break-after: always;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    cargarPedido();
  }, [params.id]);

  const cargarPedido = async () => {
    try {
      setLoading(true);
      
      // Cargar pedido
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', params.id)
        .single();

      if (pedidoError) throw pedidoError;

      // Cargar detalles con información de prendas y tallas
      const { data: detallesData, error: detallesError } = await supabase
        .from('detalle_pedidos')
        .select(`
          *,
          prenda:prendas(nombre),
          talla:tallas(nombre)
        `)
        .eq('pedido_id', params.id);

      if (detallesError) throw detallesError;

      // Combinar datos
      const pedidoCompleto: Pedido = {
        id: pedidoData.id,
        cliente_nombre: pedidoData.cliente_nombre,
        tipo_cliente: pedidoData.tipo_cliente,
        fecha: new Date(pedidoData.created_at).toLocaleDateString('es-MX'),
        total: pedidoData.total,
        subtotal: pedidoData.subtotal,
        estado: pedidoData.estado,
        notas: pedidoData.notas,
        modalidad_pago: pedidoData.modalidad_pago,
        efectivo_recibido: pedidoData.efectivo_recibido,
        detalles: detallesData.map((d: any) => ({
          prenda: d.prenda?.nombre || 'Sin nombre',
          talla: d.talla?.nombre || '-',
          cantidad: d.cantidad,
          pendiente: d.pendiente,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal,
          especificaciones: d.especificaciones,
        })),
      };

      setPedido(pedidoCompleto);
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      alert('Error al cargar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleCotizacion = () => {
    alert('Funcionalidad de cotización próximamente');
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
          <p>Pedido no encontrado</p>
          <button onClick={() => router.push('/pedidos')} className="btn btn-primary">
            Volver a Pedidos
          </button>
        </div>
      </LayoutWrapper>
    );
  }

  const anticipo = pedido.modalidad_pago === 'ANTICIPO' ? (pedido.efectivo_recibido || 0) : 0;
  const restante = pedido.total - (pedido.efectivo_recibido || 0);

  return (
    <LayoutWrapper>
      <div className="print-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Encabezado para impresión */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1>RECIBO DE PAGO</h1>
        </div>

        {/* Mensaje de éxito */}
        <div className="no-print" style={{
          backgroundColor: '#10b981',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          fontSize: '1.1rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>✓</span>
          ¡El pedido ha quedado registrado exitosamente!
        </div>

        {/* Card principal */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* Header con botones */}
          <div className="no-print" style={{
            padding: '1.5rem 2rem',
            borderBottom: '2px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📋 Detalles del Pedido
            </h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleImprimir}
                className="btn btn-danger"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={handleCotizacion}
                className="btn btn-success"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                📧 Mandar Cotización
              </button>
            </div>
          </div>

          {/* Información del pedido */}
          <div className="print-info" style={{
            padding: '2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '2rem',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div className="print-info-item">
              <p className="print-info-label" style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.25rem' }}>NO. PEDIDO</p>
              <p className="print-info-value" style={{ fontSize: '0.8rem', fontWeight: '700', margin: 0 }}>
                {pedido.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="print-info-item">
              <p className="print-info-label" style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.25rem' }}>CLIENTE</p>
              <p className="print-info-value" style={{ fontSize: '0.8rem', fontWeight: '700', margin: 0 }}>
                {pedido.cliente_nombre}
              </p>
            </div>
            <div className="print-info-item">
              <p className="print-info-label" style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.25rem' }}>FECHA</p>
              <p className="print-info-value" style={{ fontSize: '0.8rem', fontWeight: '700', margin: 0 }}>
                {pedido.fecha}
              </p>
            </div>
          </div>

          {/* Tabla de productos */}
          <div style={{ padding: '2rem' }}>
            <table className="print-table" style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: '#1f2937',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#1f2937', color: 'white' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>👕 PRENDA</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>📏 TALLA</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>🔢 CANTIDAD</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>⏰ PENDIENTE</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>$ PRECIO UNIT.</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>💰 TOTAL</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>ℹ️ ESPECIFICACIONES</th>
                </tr>
              </thead>
              <tbody>
                {pedido.detalles.map((detalle, index) => (
                  <tr 
                    key={index}
                    style={{ 
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <td className="product-name" style={{ padding: '1rem', fontWeight: '600' }}>{detalle.prenda}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span className="size-badge" style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        {detalle.talla}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>
                      {detalle.cantidad}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: detalle.pendiente > 0 ? '#f59e0b' : '#10b981'
                      }}></span>
                    </td>
                    <td className="price" style={{ padding: '1rem', textAlign: 'right' }}>
                      ${detalle.precio_unitario.toFixed(2)}
                    </td>
                    <td className="price total-cell" style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                      ${detalle.subtotal.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', color: '#6b7280', fontStyle: 'italic' }}>
                      {detalle.especificaciones || 'Sin especificaciones'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observaciones y resumen */}
          <div className="print-footer" style={{
            padding: '2rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            {/* Observaciones */}
            <div className="print-observations" style={{
              backgroundColor: '#fef3c7',
              border: '2px solid #fbbf24',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <h3 className="print-observations-title" style={{ 
                fontSize: '0.75rem', 
                fontWeight: '600',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                💬 Observaciones
              </h3>
              <p className="print-observations-text" style={{ margin: 0, fontStyle: 'italic', color: '#92400e', fontSize: '0.7rem' }}>
                {pedido.notas || 'Sin observaciones'}
              </p>
            </div>

            {/* Resumen de pagos */}
            <div className="print-summary" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="print-summary-row print-summary-total" style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>💵 TOTAL A PAGAR</span>
                <span style={{ fontSize: '1rem', fontWeight: '700' }}>${pedido.total.toFixed(2)}</span>
              </div>

              <div className="print-summary-row print-summary-anticipo" style={{
                backgroundColor: '#f3f4f6',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>📊 ANTICIPO</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>${anticipo.toFixed(2)}</span>
              </div>

              <div className="print-summary-row print-summary-restante" style={{
                backgroundColor: '#f3f4f6',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>💰 RESTANTE</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: restante > 0 ? '#ef4444' : '#10b981' }}>
                  ${restante.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Botón regresar */}
          <div className="no-print" style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
            <button
              onClick={() => router.push('/pedidos?nuevo=true')}
              className="btn btn-danger"
              style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
            >
              ← Regresar
            </button>
          </div>
        </div>

      </div>
    </LayoutWrapper>
  );
}


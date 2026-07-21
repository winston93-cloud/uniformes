'use client';

import { leerLineaVentaPedido } from '@/lib/winstonLineaVenta';

export interface DetallePedidoRecibo {
  id: string;
  prenda_id: string | null;
  talla_id: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  pendiente: number;
  especificaciones: string | null;
  prenda: { nombre: string } | null;
  talla: { nombre: string } | null;
}

export interface PedidoRecibo {
  id: string;
  folio?: string | null;
  linea_venta?: string | null;
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
  detalles: DetallePedidoRecibo[];
}

export function etiquetaLineaRecibo(pedido: PedidoRecibo): string {
  const linea = leerLineaVentaPedido(pedido as unknown as Record<string, unknown>);
  if (linea === 'tenis') return 'Tenis';
  if (linea === 'remate_tenis') return 'Remate tenis';
  if (linea === 'prendas') return 'Prendas';
  return '';
}

type ReciboPedidoTicketProps = {
  pedido: PedidoRecibo;
  id?: string;
  className?: string;
  extraStyle?: React.CSSProperties;
};

export default function ReciboPedidoTicket({ pedido, id, className, extraStyle }: ReciboPedidoTicketProps) {
  const tienePendientes = pedido.detalles.some(
    (d) => d.pendiente > 0 && d.prenda_id != null && Number(d.precio_unitario) >= 0
  );
  const nombreSucursal = pedido.sucursal?.nombre?.trim() || 'Uniformes';

  return (
    <div
      id={id}
      className={className}
      style={{
        backgroundColor: 'white',
        padding: '0.4rem 0.55rem',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '0.71rem',
        width: '100%',
        maxWidth: '828px',
        margin: '0 auto',
        ...extraStyle,
      }}
    >
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
          <div style={{ fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.1 }}>{nombreSucursal}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginTop: '0.15rem' }}>
            Ticket de venta
          </div>
        </div>

        <div style={{ flex: 1, textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.25, paddingRight: '0.35rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              columnGap: '0.3rem',
              rowGap: '0.1rem',
            }}
          >
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

      <div
        style={{
          borderTop: 'none',
          borderBottom: '1px solid #0f172a',
          marginTop: '0.35rem',
          padding: '0.2rem 0',
          marginBottom: '0.2rem',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        <table style={{ width: '100%', fontSize: '0.65rem', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ borderBottom: '1px dashed #64748b' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.2rem 0',
                  fontWeight: 900,
                  fontSize: '0.65rem',
                  letterSpacing: '0.02em',
                }}
              >
                ARTÍCULO
              </th>
              <th style={{ textAlign: 'left', padding: '0.2rem 0', fontWeight: 900, width: 86, fontSize: '0.65rem' }}>
                TALLA
              </th>
              <th style={{ textAlign: 'center', padding: '0.2rem 0.25rem', fontWeight: 900, width: 56, fontSize: '0.65rem' }}>
                CANT
              </th>
              <th style={{ textAlign: 'right', padding: '0.2rem 0', fontWeight: 900, width: 90, fontSize: '0.65rem' }}>
                PRECIO
              </th>
              <th style={{ textAlign: 'right', padding: '0.2rem 0', fontWeight: 900, width: 96, fontSize: '0.65rem' }}>
                TOTAL
              </th>
              <th style={{ textAlign: 'center', padding: '0.2rem 0', fontWeight: 900, width: 60, fontSize: '0.65rem' }}>
                EST
              </th>
            </tr>
          </thead>
          <tbody>
            {pedido.detalles.map((detalle, index) => {
              const cant = Number(detalle.cantidad) || 0;
              const esDesc =
                !detalle.prenda_id ||
                Number(detalle.precio_unitario) < 0 ||
                Number(detalle.subtotal) < 0 ||
                /descuento/i.test(String(detalle.especificaciones || detalle.prenda?.nombre || ''));
              const nombrePrenda =
                detalle.prenda?.nombre ||
                (esDesc ? 'Descuento x conjunto' : detalle.especificaciones) ||
                '—';
              const nombreTalla = detalle.talla?.nombre || '—';
              const lineaEstado = esDesc ? '—' : detalle.pendiente > 0 ? 'Pend.' : 'Ent.';
              const precioAbs = Math.abs(Number(detalle.precio_unitario) || 0);
              const subAbs = Math.abs(Number(detalle.subtotal) || 0);
              return (
                <tr
                  key={detalle.id}
                  style={{
                    borderBottom: index < pedido.detalles.length - 1 ? '1px dashed #e2e8f0' : 'none',
                  }}
                >
                  <td style={{ padding: '0.125rem 0', overflow: 'hidden' }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: esDesc ? '#0f766e' : undefined,
                      }}
                    >
                      {nombrePrenda}
                    </div>
                  </td>
                  <td style={{ padding: '0.125rem 0', overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {nombreTalla || (esDesc ? '—' : '')}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.125rem 0.2rem', fontWeight: 800 }}>{cant}</td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '0.125rem 0',
                      fontVariantNumeric: 'tabular-nums',
                      color: esDesc ? '#0f766e' : undefined,
                      fontWeight: esDesc ? 800 : undefined,
                    }}
                  >
                    {esDesc ? `-$${precioAbs.toFixed(2)}` : `$${precioAbs.toFixed(2)}`}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '0.125rem 0',
                      fontWeight: 900,
                      fontVariantNumeric: 'tabular-nums',
                      color: esDesc ? '#0f766e' : undefined,
                    }}
                  >
                    {esDesc ? `-$${subAbs.toFixed(2)}` : `$${subAbs.toFixed(2)}`}
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.125rem 0', fontWeight: 900 }}>{lineaEstado}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: '0.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '0.75rem',
            fontSize: '0.62rem',
            fontWeight: '700',
            borderTop: '1px solid #000',
            paddingTop: '0.1rem',
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>
            SUBTOTAL: <span style={{ fontWeight: 900 }}>${pedido.subtotal.toFixed(2)}</span>
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>
            TOTAL: <span style={{ fontWeight: 900 }}>${pedido.total.toFixed(2)}</span>
          </span>
        </div>
      </div>

      {tienePendientes && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #dc2626',
            borderRadius: '3px',
            padding: '0.3rem',
            marginBottom: '0.4rem',
          }}
        >
          <p
            style={{
              margin: '0 0 0.2rem 0',
              color: '#991b1b',
              fontWeight: '700',
              textAlign: 'center',
              fontSize: '0.55rem',
            }}
          >
            ⚠️ PENDIENTES DE ENTREGA
          </p>
          <div style={{ marginTop: '0.2rem', fontSize: '0.5rem' }}>
            {pedido.detalles
              .filter((d) => d.pendiente > 0 && d.prenda_id != null && Number(d.precio_unitario) >= 0)
              .map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.2rem',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    borderRadius: '2px',
                    marginBottom: '0.2rem',
                  }}
                >
                  <span style={{ color: '#991b1b', fontWeight: '600' }}>
                    {d.prenda?.nombre || '—'} - {d.talla?.nombre || '—'}
                  </span>
                  <span style={{ color: '#dc2626', fontWeight: '700' }}>{d.pendiente}</span>
                </div>
              ))}
          </div>
          <p style={{ margin: '0.2rem 0 0 0', color: '#991b1b', fontSize: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
            Pasar a recoger cuando estén disponibles
          </p>
        </div>
      )}

      {pedido.notas && (
        <div style={{ marginBottom: '0.4rem', fontSize: '0.5rem' }}>
          <strong>NOTAS:</strong>
          <p style={{ margin: '0.15rem 0', fontStyle: 'italic' }}>{pedido.notas}</p>
        </div>
      )}

      <div style={{ borderTop: '1px solid #000', paddingTop: '0.2rem', textAlign: 'center', fontSize: '0.5rem' }}>
        <p style={{ margin: '0.1rem 0' }}>¡GRACIAS POR SU COMPRA!</p>
      </div>
    </div>
  );
}

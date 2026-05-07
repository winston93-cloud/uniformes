'use client';

import { useEffect, useState, use } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { mapAlumnoRow } from '@/lib/hooks/useAlumnos';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const [isMounted, setIsMounted] = useState(false);
  const [showPrintCal, setShowPrintCal] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [printCal, setPrintCal] = useState({
    // Defaults calibrados para HP LaserJet (taller)
    leftMm: 40,
    topMm: 0,
    widthPct: 82,
    scale: 0.98,
    paddingTopMm: 2.5,
  });

  const [movimientos, setMovimientos] = useState<any[]>([]);

  useEffect(() => {
    cargarPedido();
  }, [resolvedParams.id]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const raw = localStorage.getItem('ticketPrintCal_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        setPrintCal((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    const root = document.documentElement;
    // Calibración: offsets en mm (X/Y) + ancho/escala/padding
    root.style.setProperty('--ticket-print-x', `${printCal.leftMm}mm`);
    root.style.setProperty('--ticket-print-y', `${printCal.topMm}mm`);
    root.style.setProperty('--ticket-print-width', `${printCal.widthPct}%`);
    root.style.setProperty('--ticket-print-scale', `${printCal.scale}`);
    root.style.setProperty('--ticket-print-padding-top', `${printCal.paddingTopMm}mm`);

    try {
      localStorage.setItem('ticketPrintCal_v1', JSON.stringify(printCal));
    } catch {
      // ignore
    }
  }, [isMounted, printCal]);

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
        const { data: row } = await supabase
          .from('alumno')
          .select('*')
          .eq('alumno_id', pedidoData.alumno_id)
          .maybeSingle();
        if (row) {
          const m = mapAlumnoRow(row as Record<string, unknown>);
          alumnoData = { nivel: m.nivel, grado: m.grado };
        }
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

  const esIOS = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const iOS =
      /iPad|iPhone|iPod/i.test(ua) ||
      // iPadOS 13+ reporta "MacIntel" pero con touchpoints
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    return Boolean(iOS);
  };

  const generarPdfReciboIOS = async () => {
    if (!isMounted) return;
    const target =
      (document.getElementById('recibo-impresion') as HTMLElement | null) ||
      (document.getElementById('recibo-impresion-screen') as HTMLElement | null);
    if (!target) {
      alert('No se encontró el recibo para generar PDF.');
      return;
    }

    // Abrir ventana antes (evita bloqueo de popups en iOS).
    const w = window.open('about:blank', '_blank');
    setGenerandoPdf(true);
    try {
      // Solo para iPad: adelgazar texto (no afecta laptop).
      document.documentElement.classList.add('ios-ticket-pdf');
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      document.documentElement.classList.remove('ios-ticket-pdf');

      const imgData = canvas.toDataURL('image/png');

      // Carta/3 exacto: 216mm × 93mm (landscape)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [216, 93],
        compress: true,
      });
      const pageW = 216;
      const pageH = 93;

      // Ajuste iPad: calibración para centrar y evitar recorte.
      const scale = 0.89;
      const imgW = pageW * scale;
      const imgH = pageH * scale;
      // Ajuste fino: mover a la izquierda para que NO se corte a la derecha
      const shiftRightMm = 18.0;
      const x = (pageW - imgW) / 2 + shiftRightMm;
      const y = (pageH - imgH) / 2;
      doc.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');
      const url = String(doc.output('bloburl'));

      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e: any) {
      console.error(e);
      try {
        document.documentElement.classList.remove('ios-ticket-pdf');
      } catch {
        // ignore
      }
      if (w) w.close();
      alert(`No se pudo generar el PDF del recibo: ${e?.message || e}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const imprimirRecibo = async () => {
    // En iPad/Safari AirPrint reinterpreta @page y recorta HTML; PDF fija el layout.
    if (esIOS()) {
      await generarPdfReciboIOS();
      return;
    }
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

  const Ticket = ({ id, extraStyle }: { id: string; extraStyle?: React.CSSProperties }) => (
    <div
      id={id}
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
          <div style={{ fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.1 }}>Matriz Madero</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginTop: '0.15rem' }}>
            Ticket de venta
          </div>
        </div>

        <div style={{ flex: 1, textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.25, paddingRight: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', columnGap: '0.3rem', rowGap: '0.1rem' }}>
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
              const lineaEstado = detalle.pendiente > 0 ? 'Pend.' : 'Ent.';
              return (
                <tr
                  key={detalle.id}
                  style={{
                    borderBottom: index < pedido.detalles.length - 1 ? '1px dashed #e2e8f0' : 'none',
                  }}
                >
                  <td style={{ padding: '0.125rem 0', overflow: 'hidden' }}>
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {detalle.prenda.nombre}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.125rem 0', overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {detalle.talla.nombre}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.125rem 0.2rem', fontWeight: 800 }}>{cant}</td>
                  <td style={{ textAlign: 'right', padding: '0.125rem 0', fontVariantNumeric: 'tabular-nums' }}>
                    ${detalle.precio_unitario.toFixed(2)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '0.125rem 0',
                      fontWeight: 900,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ${detalle.subtotal.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.125rem 0', fontWeight: 900 }}>
                    {lineaEstado}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totales */}
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

      {/* Advertencia de pendientes */}
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
              .filter(d => d.pendiente > 0)
              .map(d => (
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
                    {d.prenda.nombre} - {d.talla.nombre}
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

      {/* Notas */}
      {pedido.notas && (
        <div style={{ marginBottom: '0.4rem', fontSize: '0.5rem' }}>
          <strong>NOTAS:</strong>
          <p style={{ margin: '0.15rem 0', fontStyle: 'italic' }}>{pedido.notas}</p>
        </div>
      )}

      {/* Pie de página */}
      <div style={{ borderTop: '1px solid #000', paddingTop: '0.2rem', textAlign: 'center', fontSize: '0.5rem' }}>
        <p style={{ margin: '0.1rem 0' }}>¡GRACIAS POR SU COMPRA!</p>
      </div>
    </div>
  );

  return (
    <LayoutWrapper>
      <style jsx global>{`
        /* Solo durante generación de PDF en iPad */
        .ios-ticket-pdf #recibo-impresion,
        .ios-ticket-pdf #recibo-impresion *,
        .ios-ticket-pdf #recibo-impresion-screen,
        .ios-ticket-pdf #recibo-impresion-screen * {
          font-weight: 400 !important;
        }
      `}</style>
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
            height: 93mm !important;
            overflow: hidden !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* En impresión: el único hijo del body debe ser el ticket */
          body > * {
            display: none !important;
          }
          body > #recibo-impresion {
            display: block !important;
          }
          #recibo-impresion {
            position: absolute;
            top: var(--ticket-print-y, 0mm);
            left: calc(50% + var(--ticket-print-x, 0mm));
            right: auto;
            width: var(--ticket-print-width, 86%) !important;
            max-width: var(--ticket-print-width, 86%) !important;
            height: 93mm !important;
            box-sizing: border-box;
            margin: 0 !important;
            overflow: hidden !important;
            transform: translateX(-50%) scale(var(--ticket-print-scale, 0.98)) !important;
            transform-origin: top center !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .recibo-scale-wrap {
            transform: none !important;
            padding-bottom: 0 !important;
            margin: 0 !important;
          }
          .no-imprimir {
            display: none !important;
          }
          #recibo-impresion-screen {
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
            onClick={() => void imprimirRecibo()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
            disabled={generandoPdf}
          >
            {generandoPdf ? 'Generando PDF…' : '🖨️ Imprimir Recibo'}
          </button>
          <button
            onClick={() => setShowPrintCal((v) => !v)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Calibrar impresión
          </button>
        </div>

        {showPrintCal && (
          <div
            className="no-imprimir"
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '1rem',
              maxWidth: 720,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Calibración (se guarda en esta PC)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.5rem' }}>
              <label style={{ fontSize: 12, color: '#334155' }}>
                Left (mm)
                <input
                  type="number"
                  step="0.5"
                  value={printCal.leftMm}
                  onChange={(e) => setPrintCal((p) => ({ ...p, leftMm: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#334155' }}>
                Top (mm)
                <input
                  type="number"
                  step="0.5"
                  value={printCal.topMm}
                  onChange={(e) => setPrintCal((p) => ({ ...p, topMm: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#334155' }}>
                Width (%)
                <input
                  type="number"
                  step="1"
                  value={printCal.widthPct}
                  onChange={(e) => setPrintCal((p) => ({ ...p, widthPct: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#334155' }}>
                Scale
                <input
                  type="number"
                  step="0.01"
                  value={printCal.scale}
                  onChange={(e) => setPrintCal((p) => ({ ...p, scale: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#334155' }}>
                Padding-top (mm)
                <input
                  type="number"
                  step="0.5"
                  value={printCal.paddingTopMm}
                  onChange={(e) => setPrintCal((p) => ({ ...p, paddingTopMm: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </label>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: 12, color: '#475569' }}>
              Tip HP LaserJet: normalmente se corrige bajando <strong>Width</strong> (84–86) y moviendo <strong>Left</strong> a negativo (ej. -2mm) si se corta del lado derecho.
            </div>
          </div>
        )}

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
          <Ticket id="recibo-impresion-screen" />
        </div>
      </div>

      {/* Ticket exclusivo de impresión como hijo directo del body */}
      {isMounted &&
        createPortal(
          <Ticket
            id="recibo-impresion"
            extraStyle={{
              width: '88%',
              maxWidth: '88%',
              height: '93mm',
              borderRadius: 0,
              boxShadow: 'none',
              margin: 0,
              overflow: 'hidden',
              paddingTop: `${printCal.paddingTopMm}mm`,
            }}
          />,
          document.body
        )}
    </LayoutWrapper>
  );
}

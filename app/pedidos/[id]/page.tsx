'use client';

import { Suspense, useCallback, useEffect, useState, use } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchAlumnosByIds } from '@/lib/alumnoClientApi';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import ReciboPedidoTicket, { etiquetaLineaRecibo, type PedidoRecibo } from '@/components/ReciboPedidoTicket';
import {
  defaultTicketPrintCal,
  loadTicketPrintCal,
  saveTicketPrintCal,
  type TicketPrintCal,
} from '@/lib/ticketPrintCal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

async function fetchPedidoCompleto(
  id: string,
  sesionSucursalId?: string | null
): Promise<PedidoRecibo | null> {
  const { data: pedidoData, error: pedidoError } = await insforgeDb()
    .from('pedidos')
    .select(`*, sucursales(nombre, direccion, telefono)`)
    .eq('id', id)
    .single();

  if (pedidoError) {
    console.error('Error al cargar pedido:', pedidoError);
    throw pedidoError;
  }

  const pedidoSucursalId = String(pedidoData.sucursal_id ?? pedidoData.sucursalId ?? '').trim();
  if (sesionSucursalId && pedidoSucursalId && pedidoSucursalId !== sesionSucursalId) {
    return null;
  }

  let alumnoData = null;
  if (pedidoData.alumno_id) {
    const map = await fetchAlumnosByIds([String(pedidoData.alumno_id)]);
    const m = map.get(String(pedidoData.alumno_id));
    if (m) alumnoData = { nivel: m.nivel, grado: m.grado };
  }

  const { data: detallesData, error: detallesError } = await insforgeDb()
    .from('detalle_pedidos')
    .select(`*, prenda:prendas(nombre), talla:tallas(nombre)`)
    .eq('pedido_id', id)
    .order('created_at', { ascending: true });

  if (detallesError) throw detallesError;

  return {
    ...pedidoData,
    sucursal: pedidoData.sucursales || pedidoData.sucursal,
    alumno: alumnoData,
    detalles: detallesData || [],
  } as PedidoRecibo;
}

export default function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <LayoutWrapper>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Cargando pedido...</p>
          </div>
        </LayoutWrapper>
      }
    >
      <PedidoDetalleContent params={params} />
    </Suspense>
  );
}

function PedidoDetalleContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sesion } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoRecibo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [showPrintCal, setShowPrintCal] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [printCal, setPrintCal] = useState<TicketPrintCal>(() => defaultTicketPrintCal(sesion));

  const siguienteId = searchParams.get('siguiente')?.trim() || '';
  const esDobleRecibo = pedidos.length > 1;

  const cargarPedidos = useCallback(async () => {
    try {
      setLoading(true);
      const ids = [resolvedParams.id];
      if (siguienteId) ids.push(siguienteId);

      const cargados: PedidoRecibo[] = [];
      for (const id of ids) {
        const pedido = await fetchPedidoCompleto(id, sesion?.sucursal_id);
        if (!pedido) {
          alert('Este pedido pertenece a otra tienda.');
          router.push('/pedidos');
          return;
        }
        cargados.push(pedido);
      }

      setPedidos(cargados);
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      alert('Error al cargar el pedido');
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.id, siguienteId, sesion?.sucursal_id, router]);

  useEffect(() => {
    void cargarPedidos();
  }, [cargarPedidos]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    setPrintCal(loadTicketPrintCal(sesion));
  }, [isMounted, sesion?.sucursal_codigo, sesion?.es_matriz]);

  useEffect(() => {
    if (!isMounted) return;
    const root = document.documentElement;
    root.style.setProperty('--ticket-print-x', `${printCal.leftMm}mm`);
    root.style.setProperty('--ticket-print-y', `${printCal.topMm}mm`);
    root.style.setProperty('--ticket-print-width', `${printCal.widthPct}%`);
    root.style.setProperty('--ticket-print-scale', `${printCal.scale}`);
    root.style.setProperty('--ticket-print-padding-top', `${printCal.paddingTopMm}mm`);

    saveTicketPrintCal(sesion, printCal);
  }, [isMounted, printCal, sesion?.sucursal_codigo, sesion?.es_matriz]);

  const esIOS = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const iOS =
      /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1);
    return Boolean(iOS);
  };

  const generarPdfReciboIOS = async (indiceHoja = 0) => {
    if (!isMounted) return;
    const target =
      (document.getElementById(`recibo-impresion-hoja-${indiceHoja}`) as HTMLElement | null) ||
      (document.getElementById('recibo-impresion') as HTMLElement | null) ||
      (document.getElementById(`recibo-impresion-screen-${indiceHoja}`) as HTMLElement | null);
    if (!target) {
      alert('No se encontró el recibo para generar PDF.');
      return;
    }

    const w = window.open('about:blank', '_blank');
    setGenerandoPdf(true);
    try {
      document.documentElement.classList.add('ios-ticket-pdf');
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      document.documentElement.classList.remove('ios-ticket-pdf');

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [216, 93],
        compress: true,
      });
      const pageW = 216;
      const pageH = 93;
      const scale = 0.85;
      const imgW = pageW * scale;
      const imgH = pageH * scale;
      const shiftRightMm = 17.0;
      const x = (pageW - imgW) / 2 + shiftRightMm;
      const y = (pageH - imgH) / 2;
      doc.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');
      const url = String(doc.output('bloburl'));

      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e: unknown) {
      console.error(e);
      try {
        document.documentElement.classList.remove('ios-ticket-pdf');
      } catch {
        // ignore
      }
      if (w) w.close();
      const msg = e instanceof Error ? e.message : String(e);
      alert(`No se pudo generar el PDF del recibo: ${msg}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const imprimirRecibo = async () => {
    if (esIOS()) {
      for (let i = 0; i < pedidos.length; i += 1) {
        await generarPdfReciboIOS(i);
      }
      return;
    }
    window.print();
  };

  const estiloTicketImpresion = {
    width: '88%',
    maxWidth: '88%',
    height: '93mm',
    borderRadius: 0,
    boxShadow: 'none',
    margin: 0,
    overflow: 'hidden' as const,
    paddingTop: `${printCal.paddingTopMm}mm`,
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

  if (pedidos.length === 0) {
    return (
      <LayoutWrapper>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No se encontró el pedido</p>
          <button onClick={() => router.push('/pedidos')}>Volver a Pedidos</button>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <style jsx global>{`
        .ios-ticket-pdf #recibo-impresion,
        .ios-ticket-pdf #recibo-impresion *,
        .ios-ticket-pdf [id^='recibo-impresion-hoja-'],
        .ios-ticket-pdf [id^='recibo-impresion-hoja-'] *,
        .ios-ticket-pdf [id^='recibo-impresion-screen-'],
        .ios-ticket-pdf [id^='recibo-impresion-screen-'] * {
          font-weight: 400 !important;
        }
      `}</style>
      <style jsx global>{`
        @media print {
          @page {
            size: 216mm 93mm;
            margin: 0;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 216mm !important;
            height: auto !important;
            overflow: visible !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body > * {
            display: none !important;
          }
          body > #recibo-impresion {
            display: block !important;
            position: static !important;
            width: 216mm !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
          }
          #recibo-impresion .recibo-impresion-hoja {
            position: relative;
            width: 216mm !important;
            height: 93mm !important;
            overflow: hidden !important;
            page-break-after: always;
            break-after: page;
          }
          #recibo-impresion .recibo-impresion-hoja:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          #recibo-impresion .recibo-ticket-print {
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
          [id^='recibo-impresion-screen-'] {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '990px', margin: '0 auto', padding: '2rem 2.5rem' }}>
        <div className="no-imprimir" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/pedidos')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
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
              fontWeight: '600',
            }}
            disabled={generandoPdf}
          >
            {generandoPdf
              ? 'Generando PDF…'
              : esDobleRecibo
                ? '🖨️ Imprimir 2 recibos (prendas y tenis)'
                : '🖨️ Imprimir Recibo'}
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

        {esDobleRecibo && (
          <div
            className="no-imprimir"
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: 8,
              color: '#1e3a8a',
              fontSize: '0.95rem',
            }}
          >
            Venta mixta: <strong>2 recibos</strong> — primero <strong>prendas</strong> ({pedidos[0]?.folio}), luego{' '}
            <strong>tenis</strong> ({pedidos[1]?.folio}). Al imprimir salen en ese orden.
          </div>
        )}

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
              Tip HP LaserJet: normalmente se corrige bajando <strong>Width</strong> (84–86) y moviendo <strong>Left</strong>{' '}
              a negativo (ej. -2mm) si se corta del lado derecho.
            </div>
          </div>
        )}

        <div
          className="recibo-scale-wrap"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2.5rem',
            paddingBottom: '3rem',
            transform: 'scale(1.3)',
            transformOrigin: 'top center',
          }}
        >
          {pedidos.map((pedido, index) => {
            const etiqueta = etiquetaLineaRecibo(pedido);
            return (
              <div key={pedido.id} style={{ width: '100%', maxWidth: '828px' }}>
                {esDobleRecibo && (
                  <div
                    className="no-imprimir"
                    style={{
                      marginBottom: '0.75rem',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: '#1e40af',
                      textAlign: 'center',
                    }}
                  >
                    Recibo {index + 1} de {pedidos.length}
                    {etiqueta ? ` — ${etiqueta}` : ''} ({pedido.folio})
                  </div>
                )}
                <ReciboPedidoTicket pedido={pedido} id={`recibo-impresion-screen-${index}`} />
              </div>
            );
          })}
        </div>
      </div>

      {isMounted &&
        createPortal(
          <div id="recibo-impresion">
            {pedidos.map((pedido, index) => (
              <div key={pedido.id} className="recibo-impresion-hoja" id={`recibo-impresion-hoja-${index}`}>
                <ReciboPedidoTicket
                  pedido={pedido}
                  className="recibo-ticket-print"
                  extraStyle={estiloTicketImpresion}
                />
              </div>
            ))}
          </div>,
          document.body
        )}
    </LayoutWrapper>
  );
}

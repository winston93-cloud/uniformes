'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { PrendaAgrupadaReporte, VentasAgrupadasFiltro } from '@/lib/hooks/useReportes';

interface ModalReportesProps {
  onClose: () => void;
  etiquetaCuenta?: string;
  ventasAgrupadas: (filtro: VentasAgrupadasFiltro) => Promise<PrendaAgrupadaReporte[]>;
}

type TipoReporte = 'fechas' | 'folios';

export default function ModalReportes({
  onClose,
  etiquetaCuenta,
  ventasAgrupadas,
}: ModalReportesProps) {
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('fechas');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [folioInicio, setFolioInicio] = useState('');
  const [folioFin, setFolioFin] = useState('');
  const [generando, setGenerando] = useState(false);
  const [datosReporte, setDatosReporte] = useState<PrendaAgrupadaReporte[] | null>(null);
  const [resumen, setResumen] = useState<{
    tipos_prendas: number;
    total_piezas: number;
    total_monto: number;
  } | null>(null);

  const generarReporte = async () => {
    if (tipoReporte === 'fechas') {
      if (!fechaInicio || !fechaFin) {
        alert('⚠️ Por favor ingresa ambas fechas');
        return;
      }
      if (new Date(fechaFin) < new Date(fechaInicio)) {
        alert('⚠️ La fecha fin no puede ser menor que la fecha inicio');
        return;
      }
    } else {
      if (!folioInicio.trim() || !folioFin.trim()) {
        alert('⚠️ Por favor ingresa ambos folios (ej. wu0001 o 5001)');
        return;
      }
    }

    setGenerando(true);
    setDatosReporte(null);
    setResumen(null);

    try {
      const filtro: VentasAgrupadasFiltro =
        tipoReporte === 'fechas'
          ? { tipo: 'fechas', fechaInicio, fechaFin }
          : {
              tipo: 'folios',
              folioInicio: folioInicio.trim(),
              folioFin: folioFin.trim(),
            };

      const agrupado = await ventasAgrupadas(filtro);

      setDatosReporte(agrupado);
      setResumen({
        tipos_prendas: agrupado.length,
        total_piezas: agrupado.reduce((sum, p) => sum + p.subtotal_cantidad, 0),
        total_monto: agrupado.reduce((sum, p) => sum + p.subtotal_monto, 0),
      });

      if (agrupado.length === 0) {
        alert(
          `No hay ventas${etiquetaCuenta ? ` para ${etiquetaCuenta}` : ''} en el rango indicado.`
        );
      }
    } catch (error: unknown) {
      console.error('Error al generar reporte:', error);
      const msg = error instanceof Error ? error.message : 'Error al generar reporte';
      alert(msg);
    } finally {
      setGenerando(false);
    }
  };

  const exportarExcel = () => {
    if (!datosReporte || !resumen) return;

    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [];

    wsData.push([`Reporte de Ventas por ${tipoReporte === 'fechas' ? 'Fecha' : 'Folio'}`]);
    if (etiquetaCuenta) wsData.push([`Cuenta: ${etiquetaCuenta}`]);
    wsData.push([
      tipoReporte === 'fechas'
        ? `Período: ${fechaInicio} al ${fechaFin}`
        : `Folios: ${folioInicio} al ${folioFin}`,
    ]);
    wsData.push([`Generado: ${new Date().toLocaleString('es-MX')}`]);
    wsData.push([]);

    wsData.push(['RESUMEN']);
    wsData.push(['Tipos de prendas:', resumen.tipos_prendas]);
    wsData.push(['Total de piezas:', resumen.total_piezas]);
    wsData.push(['Monto total:', `$${resumen.total_monto.toFixed(2)}`]);
    wsData.push([]);

    if (tipoReporte === 'fechas') {
      wsData.push(['Prenda', 'Talla', 'Cantidad', 'Precio Unitario', 'Total']);
    } else {
      wsData.push(['Prenda', 'Talla', 'Folio', 'Cantidad', 'Precio Unitario', 'Total']);
    }

    datosReporte.forEach((prenda) => {
      prenda.detalles.forEach((detalle) => {
        if (tipoReporte === 'fechas') {
          wsData.push([
            prenda.prenda,
            detalle.talla,
            detalle.cantidad,
            detalle.precio_unitario,
            detalle.subtotal,
          ]);
        } else {
          wsData.push([
            prenda.prenda,
            detalle.talla,
            detalle.folio || '',
            detalle.cantidad,
            detalle.precio_unitario,
            detalle.subtotal,
          ]);
        }
      });

      if (tipoReporte === 'fechas') {
        wsData.push([
          `SUBTOTAL ${prenda.prenda}`,
          '',
          prenda.subtotal_cantidad,
          '',
          prenda.subtotal_monto,
        ]);
      } else {
        wsData.push([
          `SUBTOTAL ${prenda.prenda}`,
          '',
          '',
          prenda.subtotal_cantidad,
          '',
          prenda.subtotal_monto,
        ]);
      }
      wsData.push([]);
    });

    if (tipoReporte === 'fechas') {
      wsData.push(['TOTAL GENERAL', '', resumen.total_piezas, '', resumen.total_monto]);
    } else {
      wsData.push(['TOTAL GENERAL', '', '', resumen.total_piezas, '', resumen.total_monto]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

    const nombreArchivo = `Reporte_Ventas_${tipoReporte}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '2rem', color: '#667eea' }}>📊 Reportes de Ventas</h2>
          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {etiquetaCuenta && (
          <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#475569', fontSize: '0.95rem' }}>
            Cuenta activa: <strong style={{ color: '#1e40af' }}>{etiquetaCuenta}</strong>
            {' '}(usa el selector de arriba en Reportes para cambiar Winston / Uniformes).
          </p>
        )}

        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setTipoReporte('fechas');
              setDatosReporte(null);
              setResumen(null);
            }}
            style={{
              flex: '1',
              minWidth: '200px',
              padding: '1rem',
              background:
                tipoReporte === 'fechas'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'white',
              color: tipoReporte === 'fechas' ? 'white' : '#667eea',
              border: `2px solid ${tipoReporte === 'fechas' ? '#667eea' : '#ddd'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            📅 Por Rango de Fechas
          </button>
          <button
            onClick={() => {
              setTipoReporte('folios');
              setDatosReporte(null);
              setResumen(null);
            }}
            style={{
              flex: '1',
              minWidth: '200px',
              padding: '1rem',
              background:
                tipoReporte === 'folios'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'white',
              color: tipoReporte === 'folios' ? 'white' : '#667eea',
              border: `2px solid ${tipoReporte === 'folios' ? '#667eea' : '#ddd'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            📋 Por Rango de Folios
          </button>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          {tipoReporte === 'fechas' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  Fecha Inicio:
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #667eea',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  Fecha Fin:
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #667eea',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  Folio Inicio:
                </label>
                <input
                  type="text"
                  value={folioInicio}
                  onChange={(e) => setFolioInicio(e.target.value)}
                  placeholder="Ej: wu0001 o 1"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #667eea',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  Folio Fin:
                </label>
                <input
                  type="text"
                  value={folioFin}
                  onChange={(e) => setFolioFin(e.target.value)}
                  placeholder="Ej: wu0100 o 100"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #667eea',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>
          )}

          <button
            onClick={() => void generarReporte()}
            disabled={generando}
            style={{
              marginTop: '1.5rem',
              width: '100%',
              padding: '1rem',
              background: generando ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: generando ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '1.1rem',
            }}
          >
            {generando ? 'Generando…' : '📊 Generar Reporte'}
          </button>
        </div>

        {resumen && datosReporte && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{resumen.tipos_prendas}</div>
                <div>Tipos de Prendas</div>
              </div>
              <div
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{resumen.total_piezas}</div>
                <div>Total de Piezas</div>
              </div>
              <div
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                  ${resumen.total_monto.toFixed(2)}
                </div>
                <div>Monto Total</div>
              </div>
            </div>

            <button
              onClick={exportarExcel}
              style={{
                marginBottom: '1.5rem',
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Exportar a Excel
            </button>

            {datosReporte.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center' }}>
                No se encontraron ventas en este{' '}
                {tipoReporte === 'fechas' ? 'período' : 'rango de folios'}
                {etiquetaCuenta ? ` para ${etiquetaCuenta}` : ''}.
              </p>
            ) : (
              datosReporte.map((prenda) => (
                <div key={prenda.prenda} style={{ marginBottom: '2rem' }}>
                  <h3
                    style={{
                      margin: '0 0 0.75rem',
                      padding: '0.75rem 1rem',
                      background: '#f1f5f9',
                      borderRadius: '8px',
                      color: '#1e293b',
                    }}
                  >
                    {prenda.prenda}
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                    <thead>
                      <tr style={{ background: '#667eea', color: 'white' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Talla</th>
                        {tipoReporte === 'folios' && (
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Folio</th>
                        )}
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Cantidad</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>P. Unit.</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prenda.detalles.map((detalle, idx) => (
                        <tr key={`${detalle.talla}-${detalle.folio ?? ''}-${idx}`}>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                            {detalle.talla}
                          </td>
                          {tipoReporte === 'folios' && (
                            <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                              {detalle.folio || '—'}
                            </td>
                          )}
                          <td
                            style={{
                              padding: '0.75rem',
                              border: '1px solid #ddd',
                              textAlign: 'right',
                            }}
                          >
                            {detalle.cantidad} pzas
                          </td>
                          <td
                            style={{
                              padding: '0.75rem',
                              border: '1px solid #ddd',
                              textAlign: 'right',
                            }}
                          >
                            ${detalle.precio_unitario.toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: '0.75rem',
                              border: '1px solid #ddd',
                              textAlign: 'right',
                            }}
                          >
                            ${detalle.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                        <td
                          colSpan={tipoReporte === 'folios' ? 2 : 1}
                          style={{ padding: '0.75rem', border: '1px solid #ddd' }}
                        >
                          Subtotal {prenda.prenda}
                        </td>
                        <td
                          style={{
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            textAlign: 'right',
                          }}
                        >
                          {prenda.subtotal_cantidad} pzas
                        </td>
                        <td style={{ padding: '0.75rem', border: '1px solid #ddd' }} />
                        <td
                          style={{
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            textAlign: 'right',
                          }}
                        >
                          ${prenda.subtotal_monto.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ModalReportesProps {
  onClose: () => void;
}

type TipoReporte = 'fechas' | 'folios';

interface VentaDetalle {
  prenda_nombre: string;
  talla: string;
  cantidad: number;
  precio_unitario: number;
  folio?: string;
}

interface PrendaAgrupada {
  prenda: string;
  detalles: {
    talla: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    folio?: string;
  }[];
  subtotal_cantidad: number;
  subtotal_monto: number;
}

export default function ModalReportes({ onClose }: ModalReportesProps) {
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('fechas');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [folioInicio, setFolioInicio] = useState('');
  const [folioFin, setFolioFin] = useState('');
  const [generando, setGenerando] = useState(false);
  const [datosReporte, setDatosReporte] = useState<PrendaAgrupada[] | null>(null);
  const [resumen, setResumen] = useState<{
    tipos_prendas: number;
    total_piezas: number;
    total_monto: number;
  } | null>(null);

  const generarReporte = async () => {
    // Validaciones
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
      if (!folioInicio || !folioFin) {
        alert('⚠️ Por favor ingresa ambos folios');
        return;
      }
      if (parseInt(folioFin) < parseInt(folioInicio)) {
        alert('⚠️ El folio fin no puede ser menor que el folio inicio');
        return;
      }
    }

    setGenerando(true);
    
    try {
      // TODO: Aquí iría la llamada real a la API
      // Por ahora, datos de ejemplo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      const ejemploDatos: PrendaAgrupada[] = [
        {
          prenda: 'CAMISA BLANCA',
          detalles: [
            { talla: '8', cantidad: 5, precio_unitario: 150, subtotal: 750, folio: tipoReporte === 'folios' ? '5001' : undefined },
            { talla: '10', cantidad: 3, precio_unitario: 150, subtotal: 450, folio: tipoReporte === 'folios' ? '5002' : undefined },
            { talla: '12', cantidad: 2, precio_unitario: 150, subtotal: 300, folio: tipoReporte === 'folios' ? '5001' : undefined },
          ],
          subtotal_cantidad: 10,
          subtotal_monto: 1500,
        },
        {
          prenda: 'PANTALÓN AZUL MARINO',
          detalles: [
            { talla: '28', cantidad: 2, precio_unitario: 320, subtotal: 640, folio: tipoReporte === 'folios' ? '5003' : undefined },
            { talla: '30', cantidad: 4, precio_unitario: 320, subtotal: 1280, folio: tipoReporte === 'folios' ? '5001' : undefined },
            { talla: '32', cantidad: 1, precio_unitario: 320, subtotal: 320, folio: tipoReporte === 'folios' ? '5002' : undefined },
          ],
          subtotal_cantidad: 7,
          subtotal_monto: 2240,
        },
      ];

      setDatosReporte(ejemploDatos);
      setResumen({
        tipos_prendas: ejemploDatos.length,
        total_piezas: ejemploDatos.reduce((sum, p) => sum + p.subtotal_cantidad, 0),
        total_monto: ejemploDatos.reduce((sum, p) => sum + p.subtotal_monto, 0),
      });
    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('Error al generar reporte');
    } finally {
      setGenerando(false);
    }
  };

  const exportarExcel = () => {
    if (!datosReporte || !resumen) return;

    const wb = XLSX.utils.book_new();
    const wsData: any[] = [];

    // Título
    wsData.push([`Reporte de Ventas por ${tipoReporte === 'fechas' ? 'Fecha' : 'Folio'}`]);
    wsData.push([
      tipoReporte === 'fechas' 
        ? `Período: ${fechaInicio} al ${fechaFin}`
        : `Folios: #${folioInicio} al #${folioFin}`
    ]);
    wsData.push([`Generado: ${new Date().toLocaleString('es-MX')}`]);
    wsData.push([]); // Línea vacía

    // Resumen
    wsData.push(['RESUMEN']);
    wsData.push(['Tipos de prendas:', resumen.tipos_prendas]);
    wsData.push(['Total de piezas:', resumen.total_piezas]);
    wsData.push(['Monto total:', `$${resumen.total_monto.toFixed(2)}`]);
    wsData.push([]); // Línea vacía

    // Encabezados
    if (tipoReporte === 'fechas') {
      wsData.push(['Prenda/Talla', 'Cantidad', 'Precio Unitario', 'Total']);
    } else {
      wsData.push(['Prenda/Talla', 'Folio', 'Cantidad', 'Precio Unitario', 'Total']);
    }

    // Datos
    datosReporte.forEach(prenda => {
      prenda.detalles.forEach(detalle => {
        if (tipoReporte === 'fechas') {
          wsData.push([
            `  ${detalle.talla}`,
            detalle.cantidad,
            `$${detalle.precio_unitario.toFixed(2)}`,
            `$${detalle.subtotal.toFixed(2)}`
          ]);
        } else {
          wsData.push([
            `  ${detalle.talla}`,
            `#${detalle.folio}`,
            detalle.cantidad,
            `$${detalle.precio_unitario.toFixed(2)}`,
            `$${detalle.subtotal.toFixed(2)}`
          ]);
        }
      });
      
      // Subtotal de prenda
      wsData.push([
        `SUBTOTAL ${prenda.prenda}`,
        '',
        prenda.subtotal_cantidad,
        '',
        `$${prenda.subtotal_monto.toFixed(2)}`
      ]);
      wsData.push([]); // Línea vacía
    });

    // Total general
    wsData.push([
      'TOTAL GENERAL',
      '',
      resumen.total_piezas,
      '',
      `$${resumen.total_monto.toFixed(2)}`
    ]);

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
      onClick={onClose}
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0, fontSize: '2rem', color: '#667eea' }}>
            📊 Reportes de Ventas
          </h2>
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

        {/* Selector de tipo de reporte */}
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
              background: tipoReporte === 'fechas' 
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
              background: tipoReporte === 'folios'
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

        {/* Formulario */}
        <div style={{ marginBottom: '2rem' }}>
          {tipoReporte === 'fechas' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  Folio Inicio:
                </label>
                <input
                  type="number"
                  value={folioInicio}
                  onChange={(e) => setFolioInicio(e.target.value)}
                  placeholder="Ej: 5000"
                  min="1"
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
                  type="number"
                  value={folioFin}
                  onChange={(e) => setFolioFin(e.target.value)}
                  placeholder="Ej: 5100"
                  min="1"
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
            onClick={generarReporte}
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
            {generando ? '⏳ Generando...' : '📊 Generar Reporte'}
          </button>
        </div>

        {/* Resultados */}
        {datosReporte && resumen && (
          <div>
            {/* Tarjetas de resumen */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}>
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{resumen.tipos_prendas}</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Tipos de Prendas</div>
              </div>
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{resumen.total_piezas}</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total de Piezas</div>
              </div>
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                  ${resumen.total_monto.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Monto Total</div>
              </div>
            </div>

            {/* Botón exportar */}
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
              📥 Exportar a Excel
            </button>

            {/* Tabla detallada */}
            <div style={{ overflowX: 'auto' }}>
              {datosReporte.map((prenda, idx) => (
                <div key={idx} style={{ marginBottom: '2rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '1rem',
                    borderRadius: '8px 8px 0 0',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                  }}>
                    {prenda.prenda}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Talla</th>
                        {tipoReporte === 'folios' && (
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Folio</th>
                        )}
                        <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Cantidad</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>P. Unit.</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prenda.detalles.map((detalle, dIdx) => (
                        <tr key={dIdx} style={{ background: dIdx % 2 === 0 ? 'white' : '#f8f9fa' }}>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{detalle.talla}</td>
                          {tipoReporte === 'folios' && (
                            <td style={{ padding: '0.75rem', border: '1px solid #ddd', color: '#667eea', fontWeight: 'bold' }}>
                              #{detalle.folio}
                            </td>
                          )}
                          <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>
                            {detalle.cantidad} pzas
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>
                            ${detalle.precio_unitario.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>
                            ${detalle.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#fef3c7', fontWeight: 'bold' }}>
                        <td colSpan={tipoReporte === 'folios' ? 2 : 1} style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                          SUBTOTAL {prenda.prenda}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>
                          {prenda.subtotal_cantidad} pzas
                        </td>
                        <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}></td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>
                          ${prenda.subtotal_monto.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Total general */}
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '1.3rem',
                fontWeight: 'bold',
                flexWrap: 'wrap',
                gap: '1rem',
              }}>
                <div>TOTAL GENERAL</div>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <div>{resumen.total_piezas} pzas</div>
                  <div>${resumen.total_monto.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {datosReporte && datosReporte.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
            <div style={{ fontSize: '4rem' }}>📊</div>
            <div style={{ fontSize: '1.2rem', marginTop: '1rem' }}>
              No se encontraron ventas en este {tipoReporte === 'fechas' ? 'período' : 'rango de folios'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

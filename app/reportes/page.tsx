'use client';

import { useState, useEffect, useCallback } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { useReportes } from '@/lib/hooks/useReportes';
import { useCategorias } from '@/lib/hooks/useCategorias';
import ModalReportes from '@/components/ModalReportes';
import ModalFiltroInventario, { type FiltroInventarioSeleccion } from '@/components/ModalFiltroInventario';
import { mostrarPdfJsPDF, abrirVentanaPdfPlaceholder, cerrarVentanaPdf } from '@/lib/abrirPdfNavegador';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  esCuentaWinston,
  OPCIONES_FILTRO_LINEA,
  type FiltroLineaVenta,
} from '@/lib/winstonLineaVenta';

export const dynamic = 'force-dynamic';

export default function ReportesPage() {
  const { sesion } = useAuth();
  const esWinston = esCuentaWinston(sesion);
  const [filtroLineaVenta, setFiltroLineaVenta] = useState<FiltroLineaVenta>('todos');
  const {
    loading,
    ventasPorPeriodo,
    prendasMasVendidas,
    estadoInventario,
    pedidosPendientes,
    clientesFrecuentes,
    resumenGeneral,
    ingresosYGanancias,
  } = useReportes(
    sesion?.sucursal_id,
    sesion?.es_matriz,
    esWinston ? filtroLineaVenta : 'todos'
  );
  
  const [modalReportesAbierto, setModalReportesAbierto] = useState(false);
  const [modalInventarioAbierto, setModalInventarioAbierto] = useState(false);
  const [generandoInventario, setGenerandoInventario] = useState(false);

  const { categorias, loading: loadingCategorias, refetch: refetchCategorias } = useCategorias();

  const [resumen, setResumen] = useState({
    totalPedidos: 0,
    ventasTotales: 0,
    totalAlumnos: 0,
    prendasStock: 0,
  });

  // Inicializar fechas: primer día del mes actual hasta hoy
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  
  const [periodo, setPeriodo] = useState({
    fechaInicio: primerDiaMes.toISOString().split('T')[0],
    fechaFin: hoy.toISOString().split('T')[0],
  });

  useEffect(() => {
    void cargarResumen();
    refetchCategorias(false);
  }, [sesion?.sucursal_id, filtroLineaVenta]);

  const cargarResumen = useCallback(async () => {
    const datos = await resumenGeneral();
    setResumen(datos);
  }, [resumenGeneral, filtroLineaVenta]);

  const generarPDFVentas = (datos: any[]) => {
    const doc = new jsPDF();
    const tienda = sesion?.sucursal_nombre ?? 'Tienda';
    
    // Título
    doc.setFontSize(18);
    doc.text('Reporte de Ventas por Período', 14, 20);
    doc.setFontSize(11);
    doc.text(`Tienda: ${tienda}`, 14, 28);
    doc.text(`Período: ${periodo.fechaInicio} al ${periodo.fechaFin}`, 14, 34);
    
    // Calcular total
    const totalGeneral = datos.reduce((sum, v) => sum + v.total, 0);
    
    // Tabla con detalle de cada venta
    autoTable(doc, {
      startY: 35,
      head: [['ID Pedido', 'Fecha', 'Cliente', 'Tipo', 'Total']],
      body: datos.map(v => [
        `#${v.id.substring(0, 8)}`,
        new Date(v.fecha).toLocaleDateString('es-MX'),
        v.cliente,
        v.tipo_cliente === 'alumno' ? 'Alumno' : 'Externo',
        `$${v.total.toFixed(2)}`
      ]),
      foot: [['', '', '', 'Total:', `$${totalGeneral.toFixed(2)}`]],
    });
    
    // Mostrar PDF en nueva pestaña en lugar de descargar
    window.open(doc.output('bloburl'), '_blank');
  };

  const generarPDFPrendas = (datos: any[]) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Prendas Más Vendidas', 14, 20);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Prenda', 'Talla', 'Cantidad', 'Total']],
      body: datos.map(p => [
        p.prenda,
        p.talla,
        p.cantidad.toString(),
        `$${p.total.toFixed(2)}`
      ]),
    });
    
    // Mostrar PDF en nueva pestaña en lugar de descargar
    window.open(doc.output('bloburl'), '_blank');
  };

  const stockExistenteReporte = (costo: { stock?: number | null; stock_inicial?: number | null }) => {
    const actual = Number(costo.stock);
    if (Number.isFinite(actual)) return Math.max(0, Math.round(actual));
    const inicial = Number(costo.stock_inicial);
    return Number.isFinite(inicial) ? Math.max(0, Math.round(inicial)) : 0;
  };

  const stockMinimoReporte = (costo: { stock_minimo?: number | null }) => {
    const n = Number(costo.stock_minimo);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  };

  const generarPDFInventario = (datos: any[], categoriasEtiqueta: string[]) => {
    const doc = new jsPDF();
    const fechaGen = new Date().toLocaleDateString('es-MX');

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Estado de Inventario', 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generado: ${fechaGen}`, 14, 28);

    const resumenCat =
      categoriasEtiqueta.length <= 5
        ? categoriasEtiqueta.join(' · ')
        : `${categoriasEtiqueta.length} categorías seleccionadas`;
    const lineasCat = doc.splitTextToSize(`Categorías: ${resumenCat}`, 182);
    doc.text(lineasCat, 14, 35);

    const grupos = new Map<string, any[]>();
    for (const row of datos) {
      const nombre = row.categoriaNombre || 'Sin categoría';
      if (!grupos.has(nombre)) grupos.set(nombre, []);
      grupos.get(nombre)!.push(row);
    }

    const nombresCategoria = Array.from(grupos.keys()).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    let startY = 35 + lineasCat.length * 5 + 4;

    for (const nombreCat of nombresCategoria) {
      const filas = grupos.get(nombreCat) || [];
      if (startY > 250) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(nombreCat, 14, startY);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');

      autoTable(doc, {
        startY: startY + 3,
        head: [['Prenda', 'Talla', 'Stock Existente', 'Stock Mínimo']],
        body: filas.map((i) => [
          i.prenda?.nombre || '-',
          i.talla?.nombre || '-',
          stockExistenteReporte(i).toLocaleString('es-MX'),
          stockMinimoReporte(i).toLocaleString('es-MX'),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20;
      startY += 10;
    }

    return doc;
  };

  const generarInventarioConFiltro = useCallback(
    async (filtro: FiltroInventarioSeleccion) => {
      const ventanaPdf = abrirVentanaPdfPlaceholder();
      setGenerandoInventario(true);
      try {
        const datos = await estadoInventario(filtro.categoriaIds, filtro.incluirSinCategoria);
        if (datos.length === 0) {
          cerrarVentanaPdf(ventanaPdf);
          alert('No hay inventario para las categorías seleccionadas.');
          return;
        }
        const doc = generarPDFInventario(datos, filtro.etiquetas);
        const nombre = `Inventario-${new Date().toISOString().slice(0, 10)}.pdf`;
        mostrarPdfJsPDF(doc, nombre, ventanaPdf);
        setModalInventarioAbierto(false);
      } catch (error: unknown) {
        cerrarVentanaPdf(ventanaPdf);
        const msg = error instanceof Error ? error.message : String(error);
        alert(`Error al generar reporte: ${msg}`);
      } finally {
        setGenerandoInventario(false);
      }
    },
    [estadoInventario]
  );

  const generarPDFPendientes = (datos: any[]) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Pedidos Pendientes', 14, 20);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['ID Pedido', 'Cliente', 'Fecha', 'Total', 'Estado']],
      body: datos.map(p => [
        `#${p.id.substring(0, 8)}`,
        p.cliente_nombre || 'Sin cliente',
        new Date(p.created_at).toLocaleDateString('es-MX'),
        `$${p.total.toFixed(2)}`,
        p.estado
      ]),
    });
    
    // Mostrar PDF en nueva pestaña en lugar de descargar
    window.open(doc.output('bloburl'), '_blank');
  };

  const generarPDFClientes = (datos: any[]) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Clientes Frecuentes', 14, 20);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Cliente', 'Tipo', 'Pedidos', 'Total Comprado']],
      body: datos.map(c => [
        c.nombre,
        c.tipo === 'alumno' ? 'Alumno' : 'Externo',
        c.pedidos.toString(),
        `$${c.total.toFixed(2)}`
      ]),
    });
    
    // Mostrar PDF en nueva pestaña en lugar de descargar
    window.open(doc.output('bloburl'), '_blank');
  };

  const generarPDFGanancias = (datos: any) => {
    const doc = new jsPDF();
    
    // Encabezado
    doc.setFontSize(18);
    doc.text('Reporte de Ingresos y Ganancias', 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Periodo: ${datos.periodo}`, 14, 30);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 14, 36);
    
    // Resumen general
    doc.setFontSize(14);
    doc.text('Resumen', 14, 46);
    
    const resumenData = [
      ['Total Ventas', `$${datos.totalVentas.toFixed(2)}`],
      ['Total Costos', `$${datos.totalCostos.toFixed(2)}`],
      ['Ganancia Neta', `$${datos.ganancia.toFixed(2)}`],
      ['Margen de Ganancia', `${datos.margen.toFixed(2)}%`],
    ];
    
    autoTable(doc, {
      startY: 50,
      head: [['Concepto', 'Monto']],
      body: resumenData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 80, halign: 'right' },
      },
    });
    
    // Detalles por prenda
    const finalY = (doc as any).lastAutoTable.finalY || 90;
    doc.setFontSize(14);
    doc.text('Detalle por Prenda', 14, finalY + 10);
    
    const detalleData = datos.detalles.map((d: any) => [
      d.prenda,
      d.talla,
      d.cantidad.toString(),
      `$${d.ingresos.toFixed(2)}`,
      `$${d.costos.toFixed(2)}`,
      `$${d.ganancia.toFixed(2)}`,
      d.ingresos > 0 ? `${((d.ganancia / d.ingresos) * 100).toFixed(1)}%` : '0%',
    ]);
    
    autoTable(doc, {
      startY: finalY + 15,
      head: [['Prenda', 'Talla', 'Cant.', 'Ingresos', 'Costos', 'Ganancia', 'Margen']],
      body: detalleData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
      },
    });
    
    // Abrir en nueva pestaña
    window.open(doc.output('bloburl'), '_blank');
  };


  const handleGenerarReporte = async (tipo: string) => {
    try {
      let datos: any[] = [];

      switch (tipo) {
        case 'ventas':
          if (!periodo.fechaInicio || !periodo.fechaFin) {
            alert('Selecciona las fechas del período');
            return;
          }
          datos = await ventasPorPeriodo(periodo.fechaInicio, periodo.fechaFin);
          if (datos.length === 0) {
            alert('No hay datos para el período seleccionado');
            return;
          }
          generarPDFVentas(datos);
          break;

        case 'prendas':
          datos = await prendasMasVendidas(periodo.fechaInicio || undefined, periodo.fechaFin || undefined);
          if (datos.length === 0) {
            alert('No hay datos de prendas vendidas');
            return;
          }
          generarPDFPrendas(datos);
          break;

        case 'pendientes':
          datos = await pedidosPendientes();
          if (datos.length === 0) {
            alert('No hay pedidos pendientes');
            return;
          }
          generarPDFPendientes(datos);
          break;

        case 'clientes':
          datos = await clientesFrecuentes();
          if (datos.length === 0) {
            alert('No hay datos de clientes');
            return;
          }
          generarPDFClientes(datos);
          break;

        case 'ganancias':
          if (!periodo.fechaInicio || !periodo.fechaFin) {
            alert('Selecciona las fechas del período');
            return;
          }
          const reporteGanancias = await ingresosYGanancias(periodo.fechaInicio, periodo.fechaFin);
          if (!reporteGanancias || reporteGanancias.totalVentas === 0) {
            alert('No hay datos de ventas para el período seleccionado');
            return;
          }
          generarPDFGanancias(reporteGanancias);
          break;
      }
    } catch (error: any) {
      console.error('Error al generar reporte:', error);
      alert(`Error al generar reporte: ${error.message}`);
    }
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '1.5rem' }}>
          📈 Reportes y Estadísticas
        </h1>

        {sesion?.sucursal_nombre && (
          <div
            style={{
              marginBottom: '2rem',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #dbeafe',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '10px',
              padding: '0.85rem 1.15rem',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
              fontSize: '0.92rem',
            }}
          >
            Reportes de <strong style={{ color: '#1e40af' }}>{sesion.sucursal_nombre}</strong> únicamente
            (ventas, inventario y clientes de esta tienda).
            {esWinston && (
              <>
                {' '}
                Filtra por <strong>prendas (wu…)</strong> o <strong>tenis (wt…)</strong> con el selector de abajo.
              </>
            )}
          </div>
        )}

        {esWinston && (
          <div className="form-container" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Línea de reporte:
              </label>
              <select
                className="form-input"
                style={{ maxWidth: '180px', marginBottom: 0 }}
                value={filtroLineaVenta}
                onChange={(e) => setFiltroLineaVenta(e.target.value as FiltroLineaVenta)}
              >
                {OPCIONES_FILTRO_LINEA.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Resumen Rápido */}
        <div className="table-container" style={{ marginBottom: '3rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>
            Resumen General{sesion?.sucursal_nombre ? ` — ${sesion.sucursal_nombre}` : ''}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(251, 146, 60, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ec4899' }}>{resumen.totalPedidos}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Pedidos Totales</div>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981' }}>
                ${resumen.ventasTotales.toFixed(2)}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Ventas Totales</div>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#3b82f6' }}>{resumen.totalAlumnos}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Alumnos Registrados</div>
            </div>

            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)', borderRadius: '15px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#fbbf24' }}>{resumen.prendasStock}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {esWinston && filtroLineaVenta === 'tenis'
                  ? 'Tenis en Stock'
                  : esWinston && filtroLineaVenta === 'prendas'
                    ? 'Prendas en Stock'
                    : 'Prendas en Stock'}
              </div>
            </div>
          </div>
        </div>

        {/* Filtros de Período */}
        <div className="form-container" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: '600' }}>Filtros de Período</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fecha Inicio</label>
              <input
                type="date"
                className="form-input"
                value={periodo.fechaInicio}
                onChange={(e) => setPeriodo({ ...periodo, fechaInicio: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fecha Fin</label>
              <input
                type="date"
                className="form-input"
                value={periodo.fechaFin}
                onChange={(e) => setPeriodo({ ...periodo, fechaFin: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Cards de Reportes */}
        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div className="card">
            <div className="card-icon orange">
              📊
            </div>
            <h3 className="card-title">Ventas por Período</h3>
            <p className="card-description">
              Reporte de ventas diarias, semanales y mensuales
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => handleGenerarReporte('ventas')}
              disabled={loading}
            >
              {loading ? '⏳ Cargando...' : 'Generar Reporte'}
            </button>
          </div>

          <div className="card">
            <div className="card-icon purple">
              👕
            </div>
            <h3 className="card-title">Prendas Más Vendidas</h3>
            <p className="card-description">
              Top de productos con mayor demanda
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => handleGenerarReporte('prendas')}
              disabled={loading}
            >
              {loading ? '⏳ Cargando...' : 'Generar Reporte'}
            </button>
          </div>

          <div className="card">
            <div className="card-icon green">
              📦
            </div>
            <h3 className="card-title">Estado de Inventario</h3>
            <p className="card-description">
              Stock por prenda y talla, agrupado por categoría del catálogo
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => setModalInventarioAbierto(true)}
              disabled={loadingCategorias}
            >
              {loadingCategorias ? '⏳ Cargando…' : 'Elegir categorías y generar'}
            </button>
          </div>

          <div className="card">
            <div className="card-icon blue">
              💰
            </div>
            <h3 className="card-title">Ingresos y Ganancias</h3>
            <p className="card-description">
              Análisis financiero y márgenes de ganancia
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => handleGenerarReporte('ganancias')}
              disabled={loading}
            >
              {loading ? '⏳ Cargando...' : 'Generar Reporte'}
            </button>
          </div>

          <div className="card">
            <div className="card-icon yellow">
              👨‍🎓
            </div>
            <h3 className="card-title">Clientes Frecuentes</h3>
            <p className="card-description">
              Alumnos y clientes con más compras
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => handleGenerarReporte('clientes')}
              disabled={loading}
            >
              {loading ? '⏳ Cargando...' : 'Generar Reporte'}
            </button>
          </div>

          <div className="card">
            <div className="card-icon orange">
              📉
            </div>
            <h3 className="card-title">Pedidos Pendientes</h3>
            <p className="card-description">
              Pedidos sin entregar y por liquidar
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => handleGenerarReporte('pendientes')}
              disabled={loading}
            >
              {loading ? '⏳ Cargando...' : 'Generar Reporte'}
            </button>
          </div>

          <div className="card">
            <div className="card-icon blue">
              📊
            </div>
            <h3 className="card-title">Ventas Agrupadas</h3>
            <p className="card-description">
              Reportes por rango de fechas o folios, agrupados por prenda y talla
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => setModalReportesAbierto(true)}
            >
              Generar Reporte
            </button>
          </div>
        </div>

        {/* Los reportes se muestran en una nueva pestaña como PDF */}
      </div>
      
      {modalReportesAbierto && (
        <ModalReportes onClose={() => setModalReportesAbierto(false)} />
      )}

      {modalInventarioAbierto && (
        <ModalFiltroInventario
          categorias={categorias}
          loadingCategorias={loadingCategorias}
          generando={generandoInventario || loading}
          onClose={() => setModalInventarioAbierto(false)}
          onGenerar={generarInventarioConFiltro}
        />
      )}
    </LayoutWrapper>
  );
}

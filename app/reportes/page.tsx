'use client';

import { useState, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useReportes } from '@/lib/hooks/useReportes';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const dynamic = 'force-dynamic';

export default function ReportesPage() {
  const {
    loading,
    ventasPorPeriodo,
    prendasMasVendidas,
    stockBajo,
    pedidosPendientes,
    clientesFrecuentes,
    resumenGeneral,
  } = useReportes();

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
    cargarResumen();
  }, []);

  const cargarResumen = async () => {
    const datos = await resumenGeneral();
    setResumen(datos);
  };

  const generarPDFVentas = (datos: any[]) => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Reporte de Ventas por Período', 14, 20);
    doc.setFontSize(11);
    doc.text(`Período: ${periodo.fechaInicio} al ${periodo.fechaFin}`, 14, 28);
    
    // Tabla
    autoTable(doc, {
      startY: 35,
      head: [['Fecha', 'Pedidos', 'Total Ventas']],
      body: datos.map(v => [
        new Date(v.fecha).toLocaleDateString('es-MX'),
        v.pedidos.toString(),
        `$${v.total.toFixed(2)}`
      ]),
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

  const generarPDFInventario = (datos: any[]) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Estado de Inventario - Stock Bajo', 14, 20);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Prenda', 'Talla', 'Stock Inicial', 'Stock Actual', 'Estado']],
      body: datos.map(i => [
        i.prenda?.nombre || '-',
        i.talla?.nombre || '-',
        (i.stock_inicial || 0).toString(),
        i.stock.toString(),
        '⚠️ Stock Bajo'
      ]),
    });
    
    // Mostrar PDF en nueva pestaña en lugar de descargar
    window.open(doc.output('bloburl'), '_blank');
  };

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
        p.alumno?.alumno_nombre_completo || p.externo?.nombre || 'Sin cliente',
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

        case 'inventario':
          datos = await stockBajo();
          if (datos.length === 0) {
            alert('No hay productos con stock bajo');
            return;
          }
          generarPDFInventario(datos);
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
      }
    } catch (error: any) {
      console.error('Error al generar reporte:', error);
      alert(`Error al generar reporte: ${error.message}`);
    }
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '3rem' }}>
          📈 Reportes y Estadísticas
        </h1>

        {/* Resumen Rápido */}
        <div className="table-container" style={{ marginBottom: '3rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>Resumen General</h3>
          
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
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Prendas en Stock</div>
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
              Stock actual y productos con stock bajo
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => handleGenerarReporte('inventario')}
              disabled={loading}
            >
              {loading ? '⏳ Cargando...' : 'Generar Reporte'}
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
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} disabled>
              Próximamente
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
        </div>

        {/* Los reportes se muestran en una nueva pestaña como PDF */}
      </div>
    </LayoutWrapper>
  );
}

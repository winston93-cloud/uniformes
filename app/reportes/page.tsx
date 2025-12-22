'use client';

import { useState, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useReportes } from '@/lib/hooks/useReportes';

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

  const [mostrarReporte, setMostrarReporte] = useState<string | null>(null);
  const [datosReporte, setDatosReporte] = useState<any[]>([]);
  
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

  const handleGenerarReporte = async (tipo: string) => {
    setMostrarReporte(tipo);
    setDatosReporte([]);

    try {
      let datos: any[] = [];

      switch (tipo) {
        case 'ventas':
          if (!periodo.fechaInicio || !periodo.fechaFin) {
            alert('Selecciona las fechas del período');
            return;
          }
          datos = await ventasPorPeriodo(periodo.fechaInicio, periodo.fechaFin);
          break;

        case 'prendas':
          datos = await prendasMasVendidas(periodo.fechaInicio || undefined, periodo.fechaFin || undefined);
          break;

        case 'inventario':
          const { data: stock } = await stockBajo();
          datos = stock || [];
          break;

        case 'pendientes':
          const { data: pendientes } = await pedidosPendientes();
          datos = pendientes || [];
          break;

        case 'clientes':
          datos = await clientesFrecuentes();
          break;
      }

      setDatosReporte(datos);
    } catch (error: any) {
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

        {/* Resultado del Reporte */}
        {mostrarReporte && datosReporte.length > 0 && (
          <div className="table-container" style={{ marginTop: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                {mostrarReporte === 'ventas' && 'Ventas por Período'}
                {mostrarReporte === 'prendas' && 'Prendas Más Vendidas'}
                {mostrarReporte === 'inventario' && 'Stock Bajo'}
                {mostrarReporte === 'pendientes' && 'Pedidos Pendientes'}
                {mostrarReporte === 'clientes' && 'Clientes Frecuentes'}
              </h3>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setMostrarReporte(null);
                  setDatosReporte([]);
                }}
              >
                ✕ Cerrar
              </button>
            </div>

            {mostrarReporte === 'ventas' && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedidos</th>
                    <th>Total Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {datosReporte.map((venta: any, index) => (
                    <tr key={index}>
                      <td>{new Date(venta.fecha).toLocaleDateString('es-MX')}</td>
                      <td>{venta.pedidos}</td>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>${venta.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {mostrarReporte === 'prendas' && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Talla</th>
                    <th>Cantidad Vendida</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {datosReporte.map((prenda: any, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: '600' }}>{prenda.prenda}</td>
                      <td><span className="badge badge-info">{prenda.talla}</span></td>
                      <td>{prenda.cantidad}</td>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>${prenda.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {mostrarReporte === 'inventario' && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Talla</th>
                    <th>Stock Inicial</th>
                    <th>Stock Actual</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {datosReporte.map((item: any) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600' }}>{item.prenda?.nombre || '-'}</td>
                      <td><span className="badge badge-info">{item.talla?.nombre || '-'}</span></td>
                      <td style={{ fontWeight: '600' }}>{item.stock_inicial || 0}</td>
                      <td style={{ fontWeight: '600' }}>{item.stock}</td>
                      <td>
                        <span className="badge badge-danger">⚠️ Stock Bajo</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {mostrarReporte === 'pendientes' && (
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {datosReporte.map((pedido: any) => (
                    <tr key={pedido.id}>
                      <td style={{ fontFamily: 'monospace' }}>#{pedido.id.substring(0, 8)}...</td>
                      <td>
                        {pedido.alumno?.alumno_nombre_completo 
                          ? `🎓 ${pedido.alumno.alumno_nombre_completo}`
                          : pedido.externo?.nombre 
                          ? `👤 ${pedido.externo.nombre}`
                          : 'Sin cliente'}
                      </td>
                      <td>{new Date(pedido.created_at).toLocaleDateString('es-MX')}</td>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>${pedido.total.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${
                          pedido.estado === 'PEDIDO' ? 'badge-warning' : 'badge-info'
                        }`}>
                          {pedido.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {mostrarReporte === 'clientes' && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Pedidos</th>
                    <th>Total Comprado</th>
                  </tr>
                </thead>
                <tbody>
                  {datosReporte.map((cliente: any, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: '600' }}>{cliente.nombre}</td>
                      <td>
                        <span className={`badge ${cliente.tipo === 'alumno' ? 'badge-info' : 'badge-warning'}`}>
                          {cliente.tipo === 'alumno' ? '🎓 Alumno' : '👤 Externo'}
                        </span>
                      </td>
                      <td>{cliente.pedidos}</td>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>${cliente.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {mostrarReporte && datosReporte.length === 0 && loading && (
          <div className="alert alert-info" style={{ marginTop: '2rem' }}>
            ⏳ Cargando datos del reporte...
          </div>
        )}

        {mostrarReporte && datosReporte.length === 0 && !loading && (
          <div className="alert alert-info" style={{ marginTop: '2rem' }}>
            📊 No hay datos para mostrar en este reporte
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}

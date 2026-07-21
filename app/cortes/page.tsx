'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { useCortes } from '@/lib/hooks/useCortes';
import type { Corte } from '@/lib/types';
import {
  esCuentaWinston,
  OPCIONES_FILTRO_LINEA,
  OPCIONES_LINEA_CORTE,
  type FiltroLineaVenta,
  type LineaVentaWinston,
} from '@/lib/winstonLineaVenta';

export const dynamic = 'force-dynamic';

function etiquetaLineaCorte(corte: Corte): string {
  if (corte.linea_venta === 'tenis') return 'Tenis';
  if (corte.linea_venta === 'remate_tenis') return 'Remate tenis';
  if (corte.linea_venta === 'prendas') return 'Prendas';
  return 'General';
}

export default function CortesPage() {
  const { sesion } = useAuth();
  const esWinston = esCuentaWinston(sesion);
  const [filtroLineaVenta, setFiltroLineaVenta] = useState<FiltroLineaVenta>('todos');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [corteSeleccionado, setCorteSeleccionado] = useState<string | null>(null);
  const [detalleCorte, setDetalleCorte] = useState<any[] | null>(null);
  const { cortes, loading, error, crearCorte, getDetalleCorte, cerrarCorte } = useCortes(
    sesion?.sucursal_id,
    esWinston ? filtroLineaVenta : 'todos'
  );

  const [formData, setFormData] = useState({
    fechaInicio: '',
    fechaFin: '',
    lineaVenta: 'prendas' as LineaVentaWinston,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (new Date(formData.fechaInicio) > new Date(formData.fechaFin)) {
      alert('La fecha de inicio debe ser anterior a la fecha fin');
      return;
    }

    const { error } = await crearCorte(
      formData.fechaInicio,
      formData.fechaFin,
      esWinston ? formData.lineaVenta : null
    );
    
    if (error) {
      alert(`Error al crear el corte: ${error}`);
      return;
    }

    alert(
      esWinston
        ? `Corte de ${
            formData.lineaVenta === 'tenis'
              ? 'tenis'
              : formData.lineaVenta === 'remate_tenis'
                ? 'remate tenis'
                : 'prendas'
          } creado exitosamente`
        : 'Corte de caja creado exitosamente'
    );
    setFormData({ fechaInicio: '', fechaFin: '', lineaVenta: formData.lineaVenta });
    setMostrarFormulario(false);
  };

  const handleVerDetalle = async (corteId: string) => {
    setCorteSeleccionado(corteId);
    const { data, error } = await getDetalleCorte(corteId);
    
    if (error) {
      alert(`Error al cargar el detalle: ${error}`);
      return;
    }
    
    setDetalleCorte(data || []);
  };

  const handleCerrarCorte = async (corteId: string) => {
    if (confirm('¿Estás seguro de cerrar este corte? No se podrán agregar más pedidos.')) {
      const { error } = await cerrarCorte(corteId);
      
      if (error) {
        alert(`Error al cerrar el corte: ${error}`);
        return;
      }
      
      alert('Corte cerrado exitosamente');
    }
  };

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="main-container">
          <div className="loading">
            <div className="spinner"></div>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '1rem' }}>
            💵 Cortes de Caja
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ width: '100%', maxWidth: '300px' }}>
            ➕ Nuevo Corte
          </button>
        </div>

        {sesion?.sucursal_nombre && (
          <div
            style={{
              marginBottom: '1.25rem',
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
            Cortes de <strong style={{ color: '#1e40af' }}>{sesion.sucursal_nombre}</strong> únicamente.
            {esWinston ? (
              <>
                {' '}
                Genera cortes separados de <strong>prendas (wu…)</strong>, <strong>tenis (wt…)</strong> y{' '}
                <strong>remate tenis (rt…)</strong>.
              </>
            ) : (
              <> Solo se incluyen pedidos <strong>COMPLETADOS</strong> (liquidados) de esta tienda en el rango de fechas.</>
            )}
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            Error al cargar los cortes: {error}
          </div>
        )}

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Generar Nuevo Corte de Caja</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              El corte incluirá los pedidos <strong>COMPLETADOS</strong> (liquidados) de{' '}
              <strong>{sesion?.sucursal_nombre ?? 'tu tienda'}</strong> entre las fechas seleccionadas
              {esWinston ? ' para la línea seleccionada.' : '.'}
            </p>
            
            <form onSubmit={handleSubmit}>
              {esWinston && (
                <div className="form-group">
                  <label className="form-label">Línea de venta *</label>
                  <select
                    className="form-input"
                    value={formData.lineaVenta}
                    onChange={(e) =>
                      setFormData({ ...formData, lineaVenta: e.target.value as LineaVentaWinston })
                    }
                    required
                  >
                    {OPCIONES_LINEA_CORTE.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Fecha Inicio *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha Fin *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.fechaFin}
                    onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  💾 Generar Corte
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarFormulario(false)}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {corteSeleccionado && detalleCorte && (
          <div className="form-container" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Detalle del Corte</h3>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCorteSeleccionado(null);
                  setDetalleCorte(null);
                }}
              >
                ✕ Cerrar
              </button>
            </div>

            {detalleCorte.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                No hay pedidos en este corte
              </p>
            ) : (
              <div className="table-container" style={{ marginTop: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pedido ID</th>
                      <th>Cliente</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleCorte.map((detalle: any) => (
                      <tr key={detalle.id}>
                        <td style={{ fontFamily: 'monospace' }}>#{detalle.pedido_id.substring(0, 8)}...</td>
                        <td>
                          {detalle.pedido?.alumno?.alumno_nombre_completo 
                            ? `🎓 ${detalle.pedido.alumno.alumno_nombre_completo} (${detalle.pedido.alumno.alumno_ref})`
                            : detalle.pedido?.externo?.nombre 
                            ? `👤 ${detalle.pedido.externo.nombre}`
                            : 'Sin cliente'}
                        </td>
                        <td style={{ fontWeight: '600', color: '#10b981' }}>
                          ${parseFloat(detalle.pedido?.total?.toString() || '0').toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {esWinston && (
          <div className="form-container" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Ver cortes:
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

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                {esWinston && <th>Línea</th>}
                <th>Fecha Corte</th>
                <th>Período</th>
                <th>Total Pedidos</th>
                <th>Total Ventas</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cortes.length === 0 ? (
                <tr>
                  <td colSpan={esWinston ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay cortes registrados. Crea tu primer corte.
                  </td>
                </tr>
              ) : (
                cortes.map((corte: Corte) => (
                  <tr key={corte.id}>
                    <td data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{corte.id.substring(0, 8)}...</td>
                    {esWinston && (
                      <td data-label="Línea">
                        <span
                          className={`badge ${
                            corte.linea_venta === 'tenis' || corte.linea_venta === 'remate_tenis'
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}
                        >
                          {etiquetaLineaCorte(corte)}
                        </span>
                      </td>
                    )}
                    <td data-label="Fecha Creación">{new Date(corte.fecha).toLocaleDateString('es-MX')}</td>
                    <td data-label="Periodo">
                      <div style={{ fontSize: '0.9rem' }}>
                        <div>Del: {new Date(corte.fecha_inicio).toLocaleDateString('es-MX')}</div>
                        <div>Al: {new Date(corte.fecha_fin).toLocaleDateString('es-MX')}</div>
                      </div>
                    </td>
                    <td data-label="Pedidos" style={{ fontWeight: '600' }}>{corte.total_pedidos}</td>
                    <td data-label="Total Ventas" style={{ fontWeight: '700', color: '#10b981', fontSize: '1.1rem' }}>
                      ${corte.total_ventas.toFixed(2)}
                    </td>
                    <td data-label="Estado">
                      <span className={`badge ${corte.activo ? 'badge-success' : 'badge-info'}`}>
                        {corte.activo ? '✓ Activo' : '🔒 Cerrado'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                        onClick={() => handleVerDetalle(corte.id)}
                      >
                        📄 Ver Detalle
                      </button>
                      {corte.activo && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => handleCerrarCorte(corte.id)}
                        >
                          🔒 Cerrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWrapper>
  );
}

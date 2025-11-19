'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCortes } from '@/lib/hooks/useCortes';
import type { Corte } from '@/lib/types';

export default function CortesPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [corteSeleccionado, setCorteSeleccionado] = useState<string | null>(null);
  const [detalleCorte, setDetalleCorte] = useState<any[] | null>(null);
  const { cortes, loading, error, crearCorte, getDetalleCorte, cerrarCorte } = useCortes();

  const [formData, setFormData] = useState({
    fechaInicio: '',
    fechaFin: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (new Date(formData.fechaInicio) > new Date(formData.fechaFin)) {
      alert('La fecha de inicio debe ser anterior a la fecha fin');
      return;
    }

    const { error } = await crearCorte(formData.fechaInicio, formData.fechaFin);
    
    if (error) {
      alert(`Error al crear el corte: ${error}`);
      return;
    }

    alert('Corte de caja creado exitosamente');
    setFormData({ fechaInicio: '', fechaFin: '' });
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            💵 Cortes de Caja
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Corte
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar los cortes: {error}
          </div>
        )}

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Generar Nuevo Corte de Caja</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              El corte incluirá todos los pedidos <strong>LIQUIDADOS</strong> entre las fechas seleccionadas
            </p>
            
            <form onSubmit={handleSubmit}>
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

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay cortes registrados. Crea tu primer corte.
                  </td>
                </tr>
              ) : (
                cortes.map((corte: Corte) => (
                  <tr key={corte.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{corte.id.substring(0, 8)}...</td>
                    <td>{new Date(corte.fecha).toLocaleDateString('es-MX')}</td>
                    <td>
                      <div style={{ fontSize: '0.9rem' }}>
                        <div>Del: {new Date(corte.fecha_inicio).toLocaleDateString('es-MX')}</div>
                        <div>Al: {new Date(corte.fecha_fin).toLocaleDateString('es-MX')}</div>
                      </div>
                    </td>
                    <td style={{ fontWeight: '600' }}>{corte.total_pedidos}</td>
                    <td style={{ fontWeight: '700', color: '#10b981', fontSize: '1.1rem' }}>
                      ${corte.total_ventas.toFixed(2)}
                    </td>
                    <td>
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

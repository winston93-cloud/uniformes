'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';

interface Corte {
  id: number;
  fecha: string;
  fechaInicio: string;
  fechaFin: string;
  totalVentas: number;
  totalPedidos: number;
  usuario: string;
  estado: 'ACTIVO' | 'CERRADO';
}

export default function CortesPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const [cortes, setCortes] = useState<Corte[]>([
    { id: 1, fecha: '2024-11-19', fechaInicio: '2024-11-01', fechaFin: '2024-11-15', totalVentas: 15750, totalPedidos: 23, usuario: 'Admin', estado: 'CERRADO' },
    { id: 2, fecha: '2024-11-18', fechaInicio: '2024-10-16', fechaFin: '2024-10-31', totalVentas: 12300, totalPedidos: 18, usuario: 'Admin', estado: 'CERRADO' },
  ]);

  const [formData, setFormData] = useState({
    fechaInicio: '',
    fechaFin: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nuevoCorte: Corte = {
      id: Date.now(),
      fecha: new Date().toISOString().split('T')[0],
      fechaInicio: formData.fechaInicio,
      fechaFin: formData.fechaFin,
      totalVentas: 0,
      totalPedidos: 0,
      usuario: 'Admin',
      estado: 'ACTIVO',
    };
    setCortes([nuevoCorte, ...cortes]);
    setFormData({ fechaInicio: '', fechaFin: '' });
    setMostrarFormulario(false);
  };

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

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Generar Nuevo Corte de Caja</h2>
            
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

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha Corte</th>
                <th>Período</th>
                <th>Total Pedidos</th>
                <th>Total Ventas</th>
                <th>Usuario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cortes.map((corte) => (
                <tr key={corte.id}>
                  <td style={{ fontFamily: 'monospace' }}>#{corte.id}</td>
                  <td>{corte.fecha}</td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>
                      <div>Del: {corte.fechaInicio}</div>
                      <div>Al: {corte.fechaFin}</div>
                    </div>
                  </td>
                  <td style={{ fontWeight: '600' }}>{corte.totalPedidos}</td>
                  <td style={{ fontWeight: '700', color: '#10b981', fontSize: '1.1rem' }}>
                    ${corte.totalVentas.toFixed(2)}
                  </td>
                  <td>{corte.usuario}</td>
                  <td>
                    <span className={`badge ${corte.estado === 'ACTIVO' ? 'badge-success' : 'badge-info'}`}>
                      {corte.estado}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                      📄 Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWrapper>
  );
}


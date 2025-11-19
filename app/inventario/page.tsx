'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';

interface Movimiento {
  id: string | number;
  fecha: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  prenda: string;
  talla: string;
  cantidad: number;
  usuario: string;
  observaciones: string;
}

export const dynamic = 'force-dynamic';

export default function InventarioPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { costos } = useCostos();
  
  const [movimientos, setMovimientos] = useState<Movimiento[]>([
    { id: 1, fecha: '2024-11-19', tipo: 'ENTRADA', prenda: 'Camisa Blanca', talla: 'M', cantidad: 50, usuario: 'Admin', observaciones: 'Compra proveedor ABC' },
    { id: 2, fecha: '2024-11-19', tipo: 'SALIDA', prenda: 'Pantalón Azul', talla: 'L', cantidad: -3, usuario: 'Admin', observaciones: 'Pedido #1234' },
    { id: 3, fecha: '2024-11-18', tipo: 'AJUSTE', prenda: 'Suéter Gris', talla: 'S', cantidad: 5, usuario: 'Admin', observaciones: 'Corrección inventario' },
  ]);

  const [formData, setFormData] = useState({
    tipo: 'ENTRADA' as 'ENTRADA' | 'SALIDA' | 'AJUSTE',
    costo_id: '',
    cantidad: '',
    observaciones: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costo = costos.find(c => c.id === formData.costo_id);
    if (!costo) {
      alert('Selecciona un costo válido');
      return;
    }
    
    const nuevoMovimiento: Movimiento = {
      id: Date.now().toString(),
      fecha: new Date().toISOString().split('T')[0],
      tipo: formData.tipo,
      prenda: (costo as any).prenda?.nombre || '',
      talla: (costo as any).talla?.nombre || '',
      cantidad: formData.tipo === 'SALIDA' ? -parseInt(formData.cantidad) : parseInt(formData.cantidad),
      usuario: 'Admin',
      observaciones: formData.observaciones,
    };
    setMovimientos([nuevoMovimiento, ...movimientos]);
    setFormData({ tipo: 'ENTRADA', costo_id: '', cantidad: '', observaciones: '' });
    setMostrarFormulario(false);
    alert('Movimiento registrado exitosamente');
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            📦 Gestión de Inventario
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Movimiento
          </button>
        </div>

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Registrar Movimiento de Inventario</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Tipo de Movimiento *</label>
                <select
                  className="form-select"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                  required
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                  <option value="AJUSTE">Ajuste</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Prenda + Talla *</label>
                  <select
                    className="form-select"
                    value={formData.costo_id}
                    onChange={(e) => setFormData({ ...formData, costo_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar prenda y talla</option>
                    {costos.filter(c => c.activo).map(costo => (
                      <option key={costo.id} value={costo.id}>
                        {(costo as any).prenda?.nombre || '-'} - {(costo as any).talla?.nombre || '-'} (Stock: {costo.stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cantidad *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observaciones</label>
                <textarea
                  className="form-textarea"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Detalles del movimiento..."
                />
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  💾 Registrar Movimiento
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
          <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>Historial de Movimientos</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Prenda</th>
                <th>Talla</th>
                <th>Cantidad</th>
                <th>Usuario</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => (
                <tr key={mov.id}>
                  <td>{mov.fecha}</td>
                  <td>
                    <span className={`badge ${
                      mov.tipo === 'ENTRADA' ? 'badge-success' :
                      mov.tipo === 'SALIDA' ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {mov.tipo}
                    </span>
                  </td>
                  <td style={{ fontWeight: '600' }}>{mov.prenda}</td>
                  <td>{mov.talla}</td>
                  <td style={{ fontWeight: '600', color: mov.cantidad > 0 ? '#10b981' : '#ef4444' }}>
                    {mov.cantidad > 0 ? '+' : ''}{mov.cantidad}
                  </td>
                  <td>{mov.usuario}</td>
                  <td>{mov.observaciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWrapper>
  );
}


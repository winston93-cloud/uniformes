'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';

interface Costo {
  id: number;
  prenda: string;
  talla: string;
  precioCompra: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
}

export default function CostosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const [costos, setCostos] = useState<Costo[]>([
    { id: 1, prenda: 'Camisa Blanca', talla: 'M', precioCompra: 150, precioVenta: 250, stock: 50, stockMinimo: 10 },
    { id: 2, prenda: 'Pantalón Azul', talla: 'L', precioCompra: 200, precioVenta: 350, stock: 30, stockMinimo: 8 },
    { id: 3, prenda: 'Suéter Gris', talla: 'S', precioCompra: 180, precioVenta: 300, stock: 5, stockMinimo: 10 },
  ]);

  const [formData, setFormData] = useState({
    prenda: '',
    talla: '',
    precioCompra: '',
    precioVenta: '',
    stock: '',
    stockMinimo: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nuevoCosto: Costo = {
      id: Date.now(),
      prenda: formData.prenda,
      talla: formData.talla,
      precioCompra: parseFloat(formData.precioCompra),
      precioVenta: parseFloat(formData.precioVenta),
      stock: parseInt(formData.stock),
      stockMinimo: parseInt(formData.stockMinimo),
    };
    setCostos([...costos, nuevoCosto]);
    setFormData({ prenda: '', talla: '', precioCompra: '', precioVenta: '', stock: '', stockMinimo: '' });
    setMostrarFormulario(false);
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            💰 Costos y Precios
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Costo
          </button>
        </div>

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Nuevo Costo de Prenda</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Prenda *</label>
                  <select
                    className="form-select"
                    value={formData.prenda}
                    onChange={(e) => setFormData({ ...formData, prenda: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar prenda</option>
                    <option value="Camisa Blanca">Camisa Blanca</option>
                    <option value="Pantalón Azul">Pantalón Azul</option>
                    <option value="Suéter Gris">Suéter Gris</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Talla *</label>
                  <select
                    className="form-select"
                    value={formData.talla}
                    onChange={(e) => setFormData({ ...formData, talla: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar talla</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Precio de Compra *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.precioCompra}
                    onChange={(e) => setFormData({ ...formData, precioCompra: e.target.value })}
                    placeholder="$0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Precio de Venta *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.precioVenta}
                    onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                    placeholder="$0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Inicial *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Mínimo *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  💾 Guardar Costo
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
                <th>Prenda</th>
                <th>Talla</th>
                <th>Precio Compra</th>
                <th>Precio Venta</th>
                <th>Stock</th>
                <th>Stock Mínimo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {costos.map((costo) => (
                <tr key={costo.id}>
                  <td style={{ fontWeight: '600' }}>{costo.prenda}</td>
                  <td><span className="badge badge-info">{costo.talla}</span></td>
                  <td>${costo.precioCompra.toFixed(2)}</td>
                  <td style={{ fontWeight: '600', color: '#10b981' }}>${costo.precioVenta.toFixed(2)}</td>
                  <td style={{ fontWeight: '600' }}>{costo.stock}</td>
                  <td>{costo.stockMinimo}</td>
                  <td>
                    {costo.stock <= costo.stockMinimo ? (
                      <span className="badge badge-danger">⚠️ Stock Bajo</span>
                    ) : (
                      <span className="badge badge-success">✓ Stock OK</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                      ✏️ Editar
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


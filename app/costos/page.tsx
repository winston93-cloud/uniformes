'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';
import type { Costo } from '@/lib/types';

export default function CostosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { costos, loading: costosLoading, error, createCosto } = useCostos();
  const { prendas } = usePrendas();
  const { tallas } = useTallas();
  
  const [formData, setFormData] = useState({
    prenda_id: '',
    talla_id: '',
    precioCompra: '',
    precioVenta: '',
    stock: '',
    stockMinimo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const costoData = {
      prenda_id: formData.prenda_id,
      talla_id: formData.talla_id,
      precio_compra: parseFloat(formData.precioCompra),
      precio_venta: parseFloat(formData.precioVenta),
      stock_inicial: parseInt(formData.stock),
      stock: parseInt(formData.stock),
      stock_minimo: parseInt(formData.stockMinimo),
      activo: true,
    };

    const { error } = await createCosto(costoData);
    if (error) {
      alert(`Error al crear: ${error}`);
      return;
    }
    
    alert('Costo creado exitosamente');
    setFormData({ prenda_id: '', talla_id: '', precioCompra: '', precioVenta: '', stock: '', stockMinimo: '' });
    setMostrarFormulario(false);
  };

  if (costosLoading) {
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
            💰 Costos y Precios
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Costo
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar los costos: {error}
          </div>
        )}

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Nuevo Costo de Prenda</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Prenda *</label>
                  <select
                    className="form-select"
                    value={formData.prenda_id}
                    onChange={(e) => setFormData({ ...formData, prenda_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar prenda</option>
                    {prendas.filter(p => p.activo).map(prenda => (
                      <option key={prenda.id} value={prenda.id}>{prenda.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Talla *</label>
                  <select
                    className="form-select"
                    value={formData.talla_id}
                    onChange={(e) => setFormData({ ...formData, talla_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar talla</option>
                    {tallas.filter(t => t.activo).sort((a, b) => a.orden - b.orden).map(talla => (
                      <option key={talla.id} value={talla.id}>{talla.nombre}</option>
                    ))}
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
              {costos.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay costos registrados. Crea tu primer costo.
                  </td>
                </tr>
              ) : (
                costos.map((costo: any) => (
                  <tr key={costo.id}>
                    <td style={{ fontWeight: '600' }}>{costo.prenda?.nombre || '-'}</td>
                    <td><span className="badge badge-info">{costo.talla?.nombre || '-'}</span></td>
                    <td>${costo.precio_compra.toFixed(2)}</td>
                    <td style={{ fontWeight: '600', color: '#10b981' }}>${costo.precio_venta.toFixed(2)}</td>
                    <td style={{ fontWeight: '600' }}>{costo.stock}</td>
                    <td>{costo.stock_minimo}</td>
                    <td>
                      {costo.stock <= costo.stock_minimo ? (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWrapper>
  );
}

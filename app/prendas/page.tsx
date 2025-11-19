'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { usePrendas } from '@/lib/hooks/usePrendas';
import type { Prenda } from '@/lib/types';

export default function PrendasPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [prendaEditando, setPrendaEditando] = useState<Prenda | null>(null);
  const { prendas, loading, error, createPrenda, updatePrenda, deletePrenda } = usePrendas();

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    categoria: '',
    activo: true,
  });

  const categorias = ['Camisas', 'Pantalones', 'Suéteres', 'Faldas', 'Deportivo', 'Accesorios'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const prendaData = {
      nombre: formData.nombre,
      codigo: formData.codigo || null,
      descripcion: formData.descripcion || null,
      categoria: formData.categoria || null,
      activo: formData.activo,
    };

    if (prendaEditando) {
      const { error } = await updatePrenda(prendaEditando.id, prendaData);
      if (error) {
        alert(`Error al actualizar: ${error}`);
        return;
      }
      alert('Prenda actualizada exitosamente');
    } else {
      const { error } = await createPrenda(prendaData);
      if (error) {
        alert(`Error al crear: ${error}`);
        return;
      }
      alert('Prenda creada exitosamente');
    }
    
    setFormData({ nombre: '', codigo: '', descripcion: '', categoria: '', activo: true });
    setMostrarFormulario(false);
    setPrendaEditando(null);
  };

  const handleEditar = (prenda: Prenda) => {
    setPrendaEditando(prenda);
    setFormData({
      nombre: prenda.nombre,
      codigo: prenda.codigo || '',
      descripcion: prenda.descripcion || '',
      categoria: prenda.categoria || '',
      activo: prenda.activo,
    });
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta prenda?')) {
      const { error } = await deletePrenda(id);
      if (error) {
        alert(`Error al eliminar: ${error}`);
      } else {
        alert('Prenda eliminada exitosamente');
      }
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
            👕 Gestión de Prendas
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nueva Prenda
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar las prendas: {error}
          </div>
        )}

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">
              {prendaEditando ? 'Editar Prenda' : 'Nueva Prenda'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la Prenda *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Camisa Blanca, Pantalón Azul, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Código de Producto</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ej: CAM-001, PAN-001, etc."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select
                  className="form-select"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-textarea"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción detallada de la prenda..."
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span className="form-label" style={{ marginBottom: 0 }}>Prenda Activa</span>
                </label>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  {prendaEditando ? '💾 Guardar Cambios' : '➕ Crear Prenda'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setPrendaEditando(null);
                    setFormData({ nombre: '', codigo: '', descripcion: '', categoria: '', activo: true });
                  }}
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
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prendas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay prendas registradas. Crea tu primera prenda.
                  </td>
                </tr>
              ) : (
                prendas.map((prenda) => (
                  <tr key={prenda.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{prenda.codigo || '-'}</td>
                    <td style={{ fontWeight: '600' }}>{prenda.nombre}</td>
                    <td><span className="badge badge-info">{prenda.categoria || '-'}</span></td>
                    <td>{prenda.descripcion || '-'}</td>
                    <td>
                      <span className={`badge ${prenda.activo ? 'badge-success' : 'badge-danger'}`}>
                        {prenda.activo ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                        onClick={() => handleEditar(prenda)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => handleEliminar(prenda.id)}
                      >
                        🗑️ Eliminar
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

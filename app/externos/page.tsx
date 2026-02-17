'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useExternos } from '@/lib/hooks/useExternos';
import type { Externo } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function ExternosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [externoEditando, setExternoEditando] = useState<Externo | null>(null);
  const { externos, loading, error, createExterno, updateExterno, deleteExterno } = useExternos();
  
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const externoData = {
      nombre: formData.nombre,
      telefono: formData.telefono || null,
      email: formData.email || null,
      direccion: formData.direccion || null,
      activo: formData.activo,
    };

    if (externoEditando) {
      const { error } = await updateExterno(externoEditando.id, externoData);
      if (error) {
        alert(`Error al actualizar: ${error}`);
        return;
      }
      alert('Cliente externo actualizado exitosamente');
    } else {
      const { error } = await createExterno(externoData);
      if (error) {
        alert(`Error al crear: ${error}`);
        return;
      }
      alert('Cliente externo creado exitosamente');
    }
    
    setFormData({ nombre: '', telefono: '', email: '', direccion: '', activo: true });
    setMostrarFormulario(false);
    setExternoEditando(null);
  };

  const handleEditar = (externo: Externo) => {
    setExternoEditando(externo);
    setFormData({
      nombre: externo.nombre,
      telefono: externo.telefono || '',
      email: externo.email || '',
      direccion: externo.direccion || '',
      activo: externo.activo,
    });
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este cliente externo?')) {
      const { error } = await deleteExterno(id);
      if (error) {
        alert(`Error al eliminar: ${error}`);
      } else {
        alert('Cliente externo eliminado exitosamente');
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
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '1rem' }}>
            👤 Clientes Externos
          </h1>
          <button className="btn btn-primary" onClick={() => {
            setExternoEditando(null);
            setFormData({ nombre: '', telefono: '', email: '', direccion: '', activo: true });
            setMostrarFormulario(true);
          }} style={{ width: '100%', maxWidth: '300px' }}>
            ➕ Nuevo Cliente
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar los clientes externos: {error}
          </div>
        )}

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">
              {externoEditando ? 'Editar Cliente Externo' : 'Registrar Cliente Externo'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre completo del cliente"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="555-1234"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dirección</label>
                <textarea
                  className="form-textarea"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Dirección completa del cliente..."
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
                  <span className="form-label" style={{ marginBottom: 0 }}>Cliente Activo</span>
                </label>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  {externoEditando ? '💾 Guardar Cambios' : '💾 Registrar Cliente'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setExternoEditando(null);
                    setFormData({ nombre: '', telefono: '', email: '', direccion: '', activo: true });
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
                <th>ID</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {externos.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay clientes externos registrados. Crea tu primer cliente.
                  </td>
                </tr>
              ) : (
                externos.map((cliente) => (
                  <tr key={cliente.id}>
                    <td data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{cliente.id.substring(0, 8)}...</td>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>{cliente.nombre}</td>
                    <td data-label="Teléfono">{cliente.telefono || '-'}</td>
                    <td data-label="Email">{cliente.email || '-'}</td>
                    <td data-label="Dirección">{cliente.direccion || '-'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${cliente.activo ? 'badge-success' : 'badge-danger'}`}>
                        {cliente.activo ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                        onClick={() => handleEditar(cliente)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => handleEliminar(cliente.id)}
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

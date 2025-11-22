'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useTallas } from '@/lib/hooks/useTallas';
import type { Talla } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function TallasPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tallaEditando, setTallaEditando] = useState<Talla | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { tallas, loading, error, createTalla, updateTalla, deleteTalla } = useTallas();

  const [formData, setFormData] = useState({
    nombre: '',
    orden: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const tallaData = {
      nombre: formData.nombre,
      orden: parseInt(formData.orden),
      activo: formData.activo,
    };

    if (tallaEditando) {
      const { error } = await updateTalla(tallaEditando.id, tallaData);
      if (error) {
        alert(`Error al actualizar: ${error}`);
        return;
      }
      alert('Talla actualizada exitosamente');
    } else {
      const { error } = await createTalla(tallaData);
      if (error) {
        alert(`Error al crear: ${error}`);
        return;
      }
      alert('Talla creada exitosamente');
    }
    
    setFormData({ nombre: '', orden: '', activo: true });
    setMostrarFormulario(false);
    setTallaEditando(null);
  };

  const handleEditar = (talla: Talla) => {
    setTallaEditando(talla);
    setFormData({
      nombre: talla.nombre,
      orden: talla.orden.toString(),
      activo: talla.activo,
    });
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta talla?')) {
      const { error } = await deleteTalla(id);
      if (error) {
        alert(`Error al eliminar: ${error}`);
      } else {
        alert('Talla eliminada exitosamente');
      }
    }
  };

  const handleNuevo = () => {
    setTallaEditando(null);
    // Calcular el siguiente número de orden automáticamente
    const maxOrden = tallas.length > 0 ? Math.max(...tallas.map(t => t.orden)) : 0;
    setFormData({ nombre: '', orden: (maxOrden + 1).toString(), activo: true });
    setMostrarFormulario(true);
  };

  // Auto-focus en el input de búsqueda al cargar la página
  useEffect(() => {
    if (inputBusquedaRef.current) {
      inputBusquedaRef.current.focus();
    }
  }, []);

  // Filtrar tallas según la búsqueda
  const tallasFiltradas = tallas.filter(talla =>
    talla.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

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
            📏 Gestión de Tallas
          </h1>
          <button className="btn btn-primary" onClick={handleNuevo}>
            ➕ Nueva Talla
          </button>
        </div>

        {/* Input de búsqueda */}
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar talla por nombre..."
            style={{
              width: '100%',
              maxWidth: '500px',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {tallasFiltradas.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron tallas</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {tallasFiltradas.length} talla{tallasFiltradas.length !== 1 ? 's' : ''} encontrada{tallasFiltradas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar las tallas: {error}
          </div>
        )}

        {/* Formulario */}
        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">
              {tallaEditando ? 'Editar Talla' : 'Nueva Talla'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la Talla *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: XS, S, M, L, XL, 6, 8, 10, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Orden de Visualización *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.orden}
                  placeholder="Asignado automáticamente"
                  readOnly
                  required
                  style={{
                    backgroundColor: '#f0f0f0',
                    cursor: 'not-allowed',
                    color: '#666'
                  }}
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
                  <span className="form-label" style={{ marginBottom: 0 }}>Talla Activa</span>
                </label>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  {tallaEditando ? '💾 Guardar Cambios' : '➕ Crear Talla'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setTallaEditando(null);
                    setFormData({ nombre: '', orden: '', activo: true });
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabla de Tallas */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tallasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron tallas con ese nombre.' : 'No hay tallas registradas. Crea tu primera talla.'}
                  </td>
                </tr>
              ) : (
                tallasFiltradas.map((talla) => (
                  <tr key={talla.id}>
                    <td>{talla.orden}</td>
                    <td style={{ fontWeight: '600' }}>{talla.nombre}</td>
                    <td>
                      <span className={`badge ${talla.activo ? 'badge-success' : 'badge-danger'}`}>
                        {talla.activo ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                        onClick={() => handleEditar(talla)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => handleEliminar(talla.id)}
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

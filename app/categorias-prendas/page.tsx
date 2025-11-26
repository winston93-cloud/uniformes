'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCategorias } from '@/lib/hooks/useCategorias';
import type { CategoriaPrenda } from '@/lib/hooks/useCategorias';

export const dynamic = 'force-dynamic';

export default function CategoriasPrendasPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaPrenda | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { categorias, loading, error, createCategoria, updateCategoria, deleteCategoria } = useCategorias();

  const [formData, setFormData] = useState({
    nombre: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const categoriaData = {
      nombre: formData.nombre,
      activo: formData.activo,
    };

    if (categoriaEditando) {
      const { error } = await updateCategoria(categoriaEditando.id, categoriaData);
      if (error) {
        alert(`Error al actualizar: ${error}`);
        return;
      }
      alert('Categoría actualizada exitosamente');
    } else {
      const { error } = await createCategoria(categoriaData);
      if (error) {
        alert(`Error al crear: ${error}`);
        return;
      }
      alert('Categoría creada exitosamente');
    }
    
    setFormData({ nombre: '', activo: true });
    setMostrarFormulario(false);
    setCategoriaEditando(null);
    
    // Volver a poner focus en el input de búsqueda
    setTimeout(() => {
      inputBusquedaRef.current?.focus();
    }, 100);
  };

  const handleEditar = (categoria: CategoriaPrenda) => {
    setCategoriaEditando(categoria);
    setFormData({
      nombre: categoria.nombre,
      activo: categoria.activo,
    });
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta categoría? Las prendas asociadas no se eliminarán, pero perderán su categoría.')) {
      const { error } = await deleteCategoria(id);
      if (error) {
        alert(`Error al eliminar: ${error}`);
      } else {
        alert('Categoría eliminada exitosamente');
        // Volver a poner focus en el input de búsqueda
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleNuevo = () => {
    setCategoriaEditando(null);
    setFormData({ nombre: '', activo: true });
    setMostrarFormulario(true);
  };

  // Auto-focus en el input de búsqueda al cargar la página
  useEffect(() => {
    if (!loading && inputBusquedaRef.current) {
      const timer = setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Filtrar categorías según la búsqueda
  const categoriasFiltradas = categorias.filter(categoria =>
    categoria.nombre.toLowerCase().includes(busqueda.toLowerCase())
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
            🏷️ Gestión de Categorías de Prendas
          </h1>
          <button className="btn btn-primary" onClick={handleNuevo}>
            ➕ Nueva Categoría
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
            placeholder="🔍 Buscar categoría por nombre..."
            style={{
              width: '100%',
              maxWidth: '500px',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {categoriasFiltradas.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron categorías</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {categoriasFiltradas.length} categoría{categoriasFiltradas.length !== 1 ? 's' : ''} encontrada{categoriasFiltradas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar las categorías: {error}
          </div>
        )}

        {/* Formulario */}
        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">
              {categoriaEditando ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la Categoría *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Camisas, Pantalones, Suéteres, etc."
                  required
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
                  <span className="form-label" style={{ marginBottom: 0 }}>Categoría Activa</span>
                </label>
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  {categoriaEditando ? '💾 Guardar Cambios' : '➕ Crear Categoría'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setCategoriaEditando(null);
                    setFormData({ nombre: '', activo: true });
                    // Volver a poner focus en el input de búsqueda
                    setTimeout(() => {
                      inputBusquedaRef.current?.focus();
                    }, 100);
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabla de Categorías */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categoriasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron categorías con ese nombre.' : 'No hay categorías registradas. Crea tu primera categoría.'}
                  </td>
                </tr>
              ) : (
                categoriasFiltradas.map((categoria) => (
                  <tr key={categoria.id}>
                    <td style={{ fontWeight: '600' }}>{categoria.nombre}</td>
                    <td>
                      <span className={`badge ${categoria.activo ? 'badge-success' : 'badge-danger'}`}>
                        {categoria.activo ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                        onClick={() => handleEditar(categoria)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => handleEliminar(categoria.id)}
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


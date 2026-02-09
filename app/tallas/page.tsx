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
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { tallas, loading, error, createTalla, updateTalla, deleteTalla } = useTallas();

  const [formData, setFormData] = useState({
    nombre: '',
    orden: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');
    setMensajeError('');
    
    const tallaData = {
      nombre: formData.nombre.trim(),
      orden: parseInt(formData.orden),
      activo: formData.activo,
    };

    if (tallaEditando) {
      const { error } = await updateTalla(tallaEditando.id, tallaData);
      if (error) {
        setBotonEstado('error');
        if (error.includes('duplicate') || error.includes('unique') || error.includes('already exists')) {
          setMensajeError(`❌ Ya existe una talla con el nombre "${tallaData.nombre}"`);
        } else {
          setMensajeError(`❌ Error al actualizar: ${error}`);
        }
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', orden: '', activo: true });
        setMostrarFormulario(false);
        setTallaEditando(null);
        setBotonEstado('normal');
        setMensajeError('');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    } else {
      const { error } = await createTalla(tallaData);
      if (error) {
        setBotonEstado('error');
        if (error.includes('duplicate') || error.includes('unique') || error.includes('already exists')) {
          setMensajeError(`❌ Ya existe una talla con el nombre "${tallaData.nombre}"`);
        } else {
          setMensajeError(`❌ Error al crear: ${error}`);
        }
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', orden: '', activo: true });
        setMostrarFormulario(false);
        setTallaEditando(null);
        setBotonEstado('normal');
        setMensajeError('');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    }
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
      if (!error) {
        // Volver a poner focus en el input de búsqueda
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
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
    if (!loading && inputBusquedaRef.current) {
      // Pequeño delay para asegurar que el DOM esté completamente renderizado
      const timer = setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

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
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '1rem' }}>
            📏 Gestión de Tallas
          </h1>
        </div>

        {/* Input de búsqueda */}
        <div style={{ marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar talla por nombre..."
            style={{
              width: '100%',
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
            
            {mensajeError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {mensajeError}
              </div>
            )}
            
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
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{
                    backgroundColor: botonEstado === 'exito' ? '#28a745' : botonEstado === 'error' ? '#dc3545' : undefined,
                    color: botonEstado === 'exito' || botonEstado === 'error' ? 'white' : undefined,
                    borderColor: botonEstado === 'exito' ? '#28a745' : botonEstado === 'error' ? '#dc3545' : undefined,
                  }}
                >
                  {botonEstado === 'exito' 
                    ? '✓ Guardado' 
                    : botonEstado === 'error' 
                    ? '✗ Error' 
                    : tallaEditando 
                    ? '💾 Guardar Cambios' 
                    : '➕ Crear Talla'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setTallaEditando(null);
                    setFormData({ nombre: '', orden: '', activo: true });
                    setMensajeError('');
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
        
        {!mostrarFormulario && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'left', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
            <button className="btn btn-primary" onClick={handleNuevo} style={{ width: '200px' }}>
              ➕ Nueva Talla
            </button>
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
                    <td data-label="Orden">{talla.orden}</td>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>{talla.nombre}</td>
                    <td data-label="Estado">
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

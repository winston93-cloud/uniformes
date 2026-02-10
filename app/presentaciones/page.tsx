'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { usePresentaciones } from '@/lib/hooks/usePresentaciones';
import type { Presentacion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function PresentacionesPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [presentacionEditando, setPresentacionEditando] = useState<Presentacion | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { presentaciones, loading, error, createPresentacion, updatePresentacion, deletePresentacion } = usePresentaciones();

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');
    
    const presentacionData = {
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      activo: formData.activo,
    };

    if (presentacionEditando) {
      const { error } = await updatePresentacion(presentacionEditando.id, presentacionData);
      if (error) {
        setMensajeError(`❌ Error al actualizar: ${error}`);
        setModalErrorAbierto(true);
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', descripcion: '', activo: true });
        setMostrarFormulario(false);
        setPresentacionEditando(null);
        setBotonEstado('normal');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    } else {
      const { error } = await createPresentacion(presentacionData);
      if (error) {
        setMensajeError(`❌ Error al crear: ${error}`);
        setModalErrorAbierto(true);
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', descripcion: '', activo: true });
        setMostrarFormulario(false);
        setPresentacionEditando(null);
        setBotonEstado('normal');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    }
  };

  const handleEditar = (presentacion: Presentacion) => {
    setPresentacionEditando(presentacion);
    setFormData({
      nombre: presentacion.nombre,
      descripcion: presentacion.descripcion || '',
      activo: presentacion.activo,
    });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta presentación?')) {
      const { error } = await deletePresentacion(id);
      if (!error) {
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleNuevo = () => {
    setPresentacionEditando(null);
    setFormData({ nombre: '', descripcion: '', activo: true });
    setBotonEstado('normal');
    setMensajeError('');
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

  // Filtrar presentaciones según la búsqueda
  const presentacionesFiltradas = presentaciones.filter(presentacion =>
    presentacion.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (presentacion.descripcion && presentacion.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
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
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', marginBottom: '1rem', textAlign: 'center' }}>
            📦 Catálogo de Presentaciones
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
            placeholder="🔍 Buscar presentación por nombre o descripción..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {presentacionesFiltradas.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron presentaciones</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {presentacionesFiltradas.length} presentación{presentacionesFiltradas.length !== 1 ? 'es' : ''} encontrada{presentacionesFiltradas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar las presentaciones: {error}
          </div>
        )}

        {/* Formulario Modal */}
        {mostrarFormulario && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1rem',
            overflowY: 'auto'
          }}>
            <div className="form-container" style={{
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: '2rem auto',
              position: 'relative'
            }}>
              <h2 className="form-title">
                {presentacionEditando ? 'Editar Presentación' : 'Nueva Presentación'}
              </h2>
              
              <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la Presentación *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value.toUpperCase() })}
                  placeholder="Ej: Kilo, Bolsa, Metro, Rollo, Caja, etc."
                  required
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Unidad de medida o presentación del insumo
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-textarea"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción opcional de la presentación..."
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
                  <span className="form-label" style={{ marginBottom: 0 }}>Presentación Activa</span>
                </label>
              </div>

              <div className="btn-group">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{
                    backgroundColor: botonEstado === 'exito' ? '#28a745' : undefined,
                    color: botonEstado === 'exito' ? 'white' : undefined,
                    borderColor: botonEstado === 'exito' ? '#28a745' : undefined,
                  }}
                >
                  {botonEstado === 'exito' 
                    ? '✓ Guardado' 
                    : presentacionEditando 
                    ? '💾 Guardar Cambios' 
                    : '➕ Crear Presentación'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setPresentacionEditando(null);
                    setFormData({ nombre: '', descripcion: '', activo: true });
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
          </div>
        )}

        {/* Tabla de Presentaciones */}
        <div className="table-container">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={handleNuevo}>
              ➕ Nueva Presentación
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {presentacionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron presentaciones con ese criterio.' : 'No hay presentaciones registradas. Crea tu primera presentación.'}
                  </td>
                </tr>
              ) : (
                presentacionesFiltradas.map((presentacion) => (
                  <tr key={presentacion.id}>
                    <td data-label="Nombre" style={{ fontWeight: '600', fontSize: '1.1rem' }}>{presentacion.nombre}</td>
                    <td data-label="Descripción">{presentacion.descripcion || '-'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${presentacion.activo ? 'badge-success' : 'badge-danger'}`}>
                        {presentacion.activo ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => handleEditar(presentacion)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => handleEliminar(presentacion.id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de Error */}
        {modalErrorAbierto && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              textAlign: 'center'
            }}>
              <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#dc3545' }}>
                {mensajeError}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setModalErrorAbierto(false);
                  setMensajeError('');
                  setMostrarFormulario(false);
                  setPresentacionEditando(null);
                  setFormData({ nombre: '', descripcion: '', activo: true });
                  setBotonEstado('normal');
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useUbicacionesAlmacenamiento } from '@/lib/hooks/useUbicacionesAlmacenamiento';
import type { UbicacionAlmacenamiento } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function UbicacionesAlmacenamientoPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [ubicacionEditando, setUbicacionEditando] = useState<UbicacionAlmacenamiento | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string>('');
  const [modalExitoAbierto, setModalExitoAbierto] = useState(false);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { ubicaciones, loading, error, createUbicacion, updateUbicacion, deleteUbicacion } = useUbicacionesAlmacenamiento();

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');

    const ubicacionData = {
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      activo: formData.activo,
    };

    if (ubicacionEditando) {
      const { error } = await updateUbicacion(ubicacionEditando.id, ubicacionData);
      if (error) {
        setMensajeError(`❌ Error al actualizar: ${error}`);
        setModalErrorAbierto(true);
        return;
      }
      setMensajeExito('✅ Ubicación actualizada correctamente');
      setModalExitoAbierto(true);
      setTimeout(() => {
        setModalExitoAbierto(false);
        setMensajeExito('');
        setFormData({ nombre: '', descripcion: '', activo: true });
        setMostrarFormulario(false);
        setUbicacionEditando(null);
        setBotonEstado('normal');
        setTimeout(() => inputBusquedaRef.current?.focus(), 100);
      }, 2000);
    } else {
      const { error } = await createUbicacion(ubicacionData);
      if (error) {
        setMensajeError(`❌ Error al crear: ${error}`);
        setModalErrorAbierto(true);
        return;
      }
      setMensajeExito('✅ Ubicación creada correctamente');
      setModalExitoAbierto(true);
      setTimeout(() => {
        setModalExitoAbierto(false);
        setMensajeExito('');
        setFormData({ nombre: '', descripcion: '', activo: true });
        setMostrarFormulario(false);
        setUbicacionEditando(null);
        setBotonEstado('normal');
        setTimeout(() => inputBusquedaRef.current?.focus(), 100);
      }, 2000);
    }
  };

  const handleEditar = (ubicacion: UbicacionAlmacenamiento) => {
    setUbicacionEditando(ubicacion);
    setFormData({
      nombre: ubicacion.nombre,
      descripcion: ubicacion.descripcion || '',
      activo: ubicacion.activo,
    });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta ubicación?')) {
      const { error } = await deleteUbicacion(id);
      if (!error) setTimeout(() => inputBusquedaRef.current?.focus(), 100);
    }
  };

  const handleNuevo = () => {
    setUbicacionEditando(null);
    setFormData({ nombre: '', descripcion: '', activo: true });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarFormulario(true);
  };

  useEffect(() => {
    if (!loading && inputBusquedaRef.current) {
      const timer = setTimeout(() => inputBusquedaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const ubicacionesFiltradas = ubicaciones.filter(u =>
    u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (u.descripcion && u.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
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
            📍 Ubicaciones de Almacenamiento
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontSize: '1rem' }}>
            Dónde se almacenan los insumos (Taller, Bodega uno, Bodega dos, etc.)
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar ubicación..."
            style={{ width: '100%', fontSize: '1rem', padding: '0.75rem 1rem' }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {ubicacionesFiltradas.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron ubicaciones</span>
              ) : (
                <span style={{ color: '#51cf66' }}>✓ {ubicacionesFiltradas.length} ubicación{ubicacionesFiltradas.length !== 1 ? 'es' : ''} encontrada{ubicacionesFiltradas.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">Error al cargar: {error}</div>
        )}

        {mostrarFormulario && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem', overflowY: 'auto' }}>
            <div className="form-container" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: '2rem auto' }}>
              <h2 className="form-title">{ubicacionEditando ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Taller, Bodega uno, Bodega dos"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-textarea"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción opcional..."
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} style={{ width: '20px', height: '20px' }} />
                    <span className="form-label" style={{ marginBottom: 0 }}>Activa</span>
                  </label>
                </div>
                <div className="btn-group">
                  <button type="submit" className="btn btn-primary">
                    {ubicacionEditando ? '💾 Guardar' : '➕ Crear'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setMostrarFormulario(false); setUbicacionEditando(null); setFormData({ nombre: '', descripcion: '', activo: true }); }}>
                    ❌ Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="table-container">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={handleNuevo}>➕ Nueva Ubicación</button>
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
              {ubicacionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron ubicaciones.' : 'No hay ubicaciones. Crea Taller, Bodega uno, Bodega dos.'}
                  </td>
                </tr>
              ) : (
                ubicacionesFiltradas.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>{u.nombre}</td>
                    <td data-label="Descripción">{u.descripcion || '-'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>{u.activo ? '✓ Activa' : '✗ Inactiva'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleEditar(u)}>✏️ Editar</button>
                        <button className="btn btn-danger" style={{ padding: '0.5rem 1rem' }} onClick={() => handleEliminar(u.id)}>🗑️ Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {modalErrorAbierto && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%', textAlign: 'center' }}>
              <p style={{ marginBottom: '1.5rem', color: '#dc3545' }}>{mensajeError}</p>
              <button className="btn btn-primary" onClick={() => { setModalErrorAbierto(false); setMensajeError(''); }}>Cerrar</button>
            </div>
          </div>
        )}

        {modalExitoAbierto && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <p style={{ color: '#28a745', fontWeight: '600' }}>{mensajeExito}</p>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}

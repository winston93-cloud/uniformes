'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useEmpresas } from '@/lib/hooks/useEmpresas';
import type { EmpresaPrenda } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function EmpresasPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<EmpresaPrenda | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { empresas, loading, error, createEmpresa, updateEmpresa, deleteEmpresa } = useEmpresas();

  const [formData, setFormData] = useState({
    nombre: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');
    setMensajeError('');

    const empresaData = {
      nombre: formData.nombre.trim(),
      activo: formData.activo,
    };

    const nombreExiste = empresas.some(
      (emp) =>
        emp.nombre.toLowerCase() === empresaData.nombre.toLowerCase() &&
        (!empresaEditando || emp.id !== empresaEditando.id)
    );

    if (nombreExiste) {
      setMensajeError(`❌ Ya existe una empresa con el nombre "${empresaData.nombre}"`);
      setModalErrorAbierto(true);
      return;
    }

    if (empresaEditando) {
      const { error } = await updateEmpresa(empresaEditando.id, empresaData);
      if (error) {
        if (error.includes('duplicate') || error.includes('unique')) {
          setMensajeError(`❌ Ya existe una empresa con el nombre "${empresaData.nombre}"`);
        } else {
          setMensajeError(`❌ Error al actualizar: ${error}`);
        }
        setModalErrorAbierto(true);
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', activo: true });
        setMostrarFormulario(false);
        setEmpresaEditando(null);
        setBotonEstado('normal');
        setMensajeError('');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    } else {
      const { error } = await createEmpresa(empresaData);
      if (error) {
        if (error.includes('duplicate') || error.includes('unique')) {
          setMensajeError(`❌ Ya existe una empresa con el nombre "${empresaData.nombre}"`);
        } else {
          setMensajeError(`❌ Error al crear: ${error}`);
        }
        setModalErrorAbierto(true);
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', activo: true });
        setMostrarFormulario(false);
        setEmpresaEditando(null);
        setBotonEstado('normal');
        setMensajeError('');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    }
  };

  const handleEditar = (empresa: EmpresaPrenda) => {
    setEmpresaEditando(empresa);
    setFormData({
      nombre: empresa.nombre,
      activo: empresa.activo,
    });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (
      confirm(
        '¿Estás seguro de eliminar esta empresa? Las prendas asociadas no se eliminarán; quedarán sin empresa.'
      )
    ) {
      const { error } = await deleteEmpresa(id);
      if (!error) {
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleNuevo = () => {
    setEmpresaEditando(null);
    setFormData({ nombre: '', activo: true });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarFormulario(true);
  };

  useEffect(() => {
    if (!loading && inputBusquedaRef.current) {
      const timer = setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const empresasFiltradas = empresas.filter((empresa) =>
    empresa.nombre.toLowerCase().includes(busqueda.toLowerCase())
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
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: 'white',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              marginBottom: '0.5rem',
              textAlign: 'center',
            }}
          >
            🏢 Empresas del catálogo
          </h1>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.9)' }}>
            Asocia modelos a una empresa (opcional) y fíltralos en Prendas → Por empresa.
          </p>
          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <a href="/prendas" style={{ color: 'white', textDecoration: 'underline' }}>
              ← Volver al catálogo de prendas
            </a>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar empresa por nombre..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
        </div>

        {error && (
          <div className="alert alert-error">Error al cargar las empresas: {error}</div>
        )}

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">
              {empresaEditando ? 'Editar Empresa' : 'Nueva Empresa'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la Empresa *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value.trimStart() })
                  }
                  placeholder="Ej: prueba, Colegio X, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span className="form-label" style={{ marginBottom: 0 }}>
                    Empresa Activa
                  </span>
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
                    : empresaEditando
                      ? '💾 Guardar Cambios'
                      : '➕ Crear Empresa'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setEmpresaEditando(null);
                    setFormData({ nombre: '', activo: true });
                    setMensajeError('');
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

        <div className="table-container">
          {!mostrarFormulario && (
            <div style={{ marginBottom: '1rem', textAlign: 'right', padding: '0 1rem' }}>
              <button className="btn btn-primary" onClick={handleNuevo} style={{ width: '200px' }}>
                ➕ Nueva Empresa
              </button>
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th className="table-col-eliminar" aria-label="Eliminar" />
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresasFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}
                  >
                    {busqueda
                      ? 'No se encontraron empresas con ese nombre.'
                      : 'No hay empresas registradas. Crea la primera.'}
                  </td>
                </tr>
              ) : (
                empresasFiltradas.map((empresa) => (
                  <tr key={empresa.id}>
                    <td className="table-col-eliminar" data-label="">
                      <button
                        type="button"
                        className="btn btn-danger btn-eliminar-fila"
                        onClick={() => handleEliminar(empresa.id)}
                        title="Eliminar empresa"
                        aria-label="Eliminar empresa"
                      >
                        🗑️
                      </button>
                    </td>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>
                      {empresa.nombre}
                    </td>
                    <td data-label="Estado">
                      <span
                        className={`badge ${empresa.activo ? 'badge-success' : 'badge-danger'}`}
                      >
                        {empresa.activo ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => handleEditar(empresa)}
                      >
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

      {modalErrorAbierto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#dc3545', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700' }}>
              Error
            </h3>
            <p style={{ color: '#333', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: 1.5 }}>
              {mensajeError}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setModalErrorAbierto(false);
                setMensajeError('');
              }}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: '600' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
}

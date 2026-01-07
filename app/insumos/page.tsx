'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useInsumos } from '@/lib/hooks/useInsumos';
import type { Insumo } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Opciones de presentación comunes
const PRESENTACIONES = [
  'Kilo',
  'Bolsa',
  'Metro',
  'Rollo',
  'Caja',
  'Paquete',
  'Pieza',
  'Litro',
  'Unidad',
  'Docena',
  'Otro',
];

// Función para generar código automático
const generarCodigo = (nombre: string, insumos: Insumo[]): string => {
  if (!nombre || nombre.trim() === '') return '';
  
  // Remover acentos y caracteres especiales
  const sinAcentos = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  
  // Tomar las primeras 3 letras
  const prefijo = sinAcentos.substring(0, 3);
  
  // Buscar el siguiente número secuencial
  const codigosSimilares = insumos
    .filter(i => i.codigo && i.codigo.startsWith(prefijo))
    .map(i => {
      const match = i.codigo?.match(/\d+$/);
      return match ? parseInt(match[0]) : 0;
    });
  
  const siguienteNumero = codigosSimilares.length > 0 
    ? Math.max(...codigosSimilares) + 1 
    : 1;
  
  return `${prefijo}-${String(siguienteNumero).padStart(3, '0')}`;
};

export default function InsumosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState<Insumo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { insumos, loading, error, createInsumo, updateInsumo, deleteInsumo } = useInsumos();

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    presentacion: '',
    cantidad_por_presentacion: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');
    
    const insumoData = {
      nombre: formData.nombre,
      codigo: formData.codigo,
      descripcion: formData.descripcion || null,
      presentacion: formData.presentacion,
      cantidad_por_presentacion: parseFloat(formData.cantidad_por_presentacion) || 0,
      activo: formData.activo,
    };

    if (insumoEditando) {
      const { error } = await updateInsumo(insumoEditando.id, insumoData);
      if (error) {
        setBotonEstado('error');
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', codigo: '', descripcion: '', presentacion: '', cantidad_por_presentacion: '', activo: true });
        setMostrarFormulario(false);
        setInsumoEditando(null);
        setBotonEstado('normal');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    } else {
      const { error } = await createInsumo(insumoData);
      if (error) {
        setBotonEstado('error');
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', codigo: '', descripcion: '', presentacion: '', cantidad_por_presentacion: '', activo: true });
        setMostrarFormulario(false);
        setInsumoEditando(null);
        setBotonEstado('normal');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    }
  };

  const handleEditar = (insumo: Insumo) => {
    setInsumoEditando(insumo);
    setFormData({
      nombre: insumo.nombre,
      codigo: insumo.codigo,
      descripcion: insumo.descripcion || '',
      presentacion: insumo.presentacion,
      cantidad_por_presentacion: insumo.cantidad_por_presentacion.toString(),
      activo: insumo.activo,
    });
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este insumo?')) {
      const { error } = await deleteInsumo(id);
      if (!error) {
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleNuevo = () => {
    setInsumoEditando(null);
    setFormData({ nombre: '', codigo: '', descripcion: '', presentacion: '', cantidad_por_presentacion: '', activo: true });
    setMostrarFormulario(true);
  };

  // Manejar cambio en el nombre para generar código automático
  const handleNombreChange = (nombre: string) => {
    if (!insumoEditando && nombre) {
      const codigoGenerado = generarCodigo(nombre, insumos);
      setFormData({ ...formData, nombre, codigo: codigoGenerado });
    } else {
      setFormData({ ...formData, nombre });
    }
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

  // Filtrar insumos según la búsqueda
  const insumosFiltrados = insumos.filter(insumo =>
    insumo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (insumo.codigo && insumo.codigo.toLowerCase().includes(busqueda.toLowerCase())) ||
    (insumo.descripcion && insumo.descripcion.toLowerCase().includes(busqueda.toLowerCase())) ||
    insumo.presentacion.toLowerCase().includes(busqueda.toLowerCase())
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
            🧵 Catálogo de Insumos
          </h1>
          <button className="btn btn-primary" onClick={handleNuevo} style={{ width: '100%', maxWidth: '300px' }}>
            ➕ Nuevo Insumo
          </button>
        </div>

        {/* Input de búsqueda */}
        <div style={{ marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar insumo por nombre, código, descripción o presentación..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {insumosFiltrados.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron insumos</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {insumosFiltrados.length} insumo{insumosFiltrados.length !== 1 ? 's' : ''} encontrado{insumosFiltrados.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar los insumos: {error}
          </div>
        )}

        {/* Formulario */}
        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">
              {insumoEditando ? 'Editar Insumo' : 'Nuevo Insumo'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre del Insumo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => handleNombreChange(e.target.value)}
                  placeholder="Ej: Botones Blancos, Tela Azul, Hilo Poliéster, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Código *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Se genera automáticamente"
                  required
                  style={{
                    backgroundColor: insumoEditando ? 'white' : '#f0f0f0',
                    cursor: insumoEditando ? 'text' : 'not-allowed',
                    color: insumoEditando ? 'inherit' : '#666'
                  }}
                  readOnly={!insumoEditando}
                />
                {!insumoEditando && (
                  <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    El código se genera automáticamente al escribir el nombre
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Presentación *</label>
                <select
                  className="form-select"
                  value={formData.presentacion}
                  onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })}
                  required
                >
                  <option value="">Seleccionar presentación</option>
                  {PRESENTACIONES.map(pres => (
                    <option key={pres} value={pres}>{pres}</option>
                  ))}
                </select>
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Unidad de medida del insumo (Kilo, Bolsa, Metro, etc.)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Cantidad por Presentación *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.cantidad_por_presentacion}
                  onChange={(e) => setFormData({ ...formData, cantidad_por_presentacion: e.target.value })}
                  placeholder="Ej: 500 (botones en una bolsa)"
                  required
                  min="0"
                />
                <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Cantidad de unidades que contiene cada presentación (Ej: 500 botones por bolsa, 1 metro por metro)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-textarea"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción detallada del insumo, características, color, material, etc."
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
                  <span className="form-label" style={{ marginBottom: 0 }}>Insumo Activo</span>
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
                    : insumoEditando 
                    ? '💾 Guardar Cambios' 
                    : '➕ Crear Insumo'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setInsumoEditando(null);
                    setFormData({ nombre: '', codigo: '', descripcion: '', presentacion: '', cantidad_por_presentacion: '', activo: true });
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

        {/* Tabla de Insumos */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Presentación</th>
                <th>Cantidad</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insumosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron insumos con ese criterio.' : 'No hay insumos registrados. Crea tu primer insumo.'}
                  </td>
                </tr>
              ) : (
                insumosFiltrados.map((insumo) => (
                  <tr key={insumo.id}>
                    <td data-label="Código" style={{ fontFamily: 'monospace', fontWeight: '600' }}>{insumo.codigo}</td>
                    <td data-label="Nombre" style={{ fontWeight: '600' }}>{insumo.nombre}</td>
                    <td data-label="Presentación"><span className="badge badge-info">{insumo.presentacion}</span></td>
                    <td data-label="Cantidad" style={{ fontWeight: '600', color: '#3b82f6' }}>
                      {insumo.cantidad_por_presentacion} {insumo.cantidad_por_presentacion === 1 ? 'unidad' : 'unidades'}
                    </td>
                    <td data-label="Descripción">{insumo.descripcion || '-'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${insumo.activo ? 'badge-success' : 'badge-danger'}`}>
                        {insumo.activo ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                        onClick={() => handleEditar(insumo)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => handleEliminar(insumo.id)}
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


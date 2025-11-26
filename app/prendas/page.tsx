'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useCategorias } from '@/lib/hooks/useCategorias';
import type { Prenda } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Función para generar código automático basado en el nombre
const generarCodigo = (nombre: string): string => {
  if (!nombre || nombre.trim() === '') return '';
  
  // Remover acentos y caracteres especiales
  const sinAcentos = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  
  // Extraer palabras clave comunes
  const palabras = sinAcentos.split(/\s+/);
  let codigo = '';
  
  // Buscar palabras clave conocidas
  const palabrasClave: { [key: string]: string } = {
    'CAMISA': 'CAM',
    'PANTALON': 'PAN',
    'PANTALÓN': 'PAN',
    'PANTS': 'PAN',
    'SUETER': 'SUE',
    'SUÉTER': 'SUE',
    'FALDA': 'FAL',
    'DEPORTIVO': 'DEP',
    'DEPORTIVA': 'DEP',
    'ACCESORIO': 'ACC',
    'BLUSA': 'BLU',
    'PLAYERA': 'PLA',
    'POLO': 'POL',
    'CHALECO': 'CHA',
    'SACO': 'SAC',
    'ABRIGO': 'ABR',
  };
  
  // Buscar palabra clave
  for (const palabra of palabras) {
    const clave = Object.keys(palabrasClave).find(k => palabra.includes(k));
    if (clave) {
      codigo = palabrasClave[clave];
      break;
    }
  }
  
  // Si no se encontró palabra clave, usar primeras 3 letras
  if (!codigo) {
    codigo = palabras[0].substring(0, 3).toUpperCase();
  }
  
  // Agregar número secuencial (por ahora solo el código base)
  // En producción, podrías buscar el último número usado
  return codigo;
};

export default function PrendasPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [prendaEditando, setPrendaEditando] = useState<Prenda | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const { prendas, loading, error, createPrenda, updatePrenda, deletePrenda } = usePrendas();
  const { categorias, loading: loadingCategorias, refetch: refetchCategorias } = useCategorias();

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    categoria_id: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotonEstado('normal');
    
    const prendaData = {
      nombre: formData.nombre,
      codigo: formData.codigo || null,
      descripcion: formData.descripcion || null,
      categoria_id: formData.categoria_id || null,
      activo: formData.activo,
    };

    if (prendaEditando) {
      const { error } = await updatePrenda(prendaEditando.id, prendaData);
      if (error) {
        setBotonEstado('error');
        return;
      }
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
        setMostrarFormulario(false);
        setPrendaEditando(null);
        setBotonEstado('normal');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    } else {
      const { error } = await createPrenda(prendaData);
      if (error) {
        setBotonEstado('error');
        return;
      }
      setBotonEstado('exito');
      await refetchCategorias(); // Recargar categorías
      setTimeout(() => {
        setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
        setMostrarFormulario(false);
        setPrendaEditando(null);
        setBotonEstado('normal');
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }, 1500);
    }
  };

  const handleEditar = (prenda: Prenda) => {
    setPrendaEditando(prenda);
    setFormData({
      nombre: prenda.nombre,
      codigo: prenda.codigo || '',
      descripcion: prenda.descripcion || '',
      categoria_id: prenda.categoria_id || '',
      activo: prenda.activo,
    });
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta prenda?')) {
      const { error } = await deletePrenda(id);
      if (error) {
        // Error silencioso, solo se elimina de la lista
      } else {
        // Volver a poner focus en el input de búsqueda
        setTimeout(() => {
          inputBusquedaRef.current?.focus();
        }, 100);
      }
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

  // Manejar cambio en el nombre para generar código automático
  const handleNombreChange = (nombre: string) => {
    if (!prendaEditando && nombre) {
      const codigoGenerado = generarCodigo(nombre);
      if (codigoGenerado) {
        // Buscar el siguiente número secuencial
        const codigosSimilares = prendas
          .filter(p => p.codigo && p.codigo.startsWith(codigoGenerado))
          .map(p => {
            const match = p.codigo?.match(/\d+$/);
            return match ? parseInt(match[0]) : 0;
          });
        const siguienteNumero = codigosSimilares.length > 0 
          ? Math.max(...codigosSimilares) + 1 
          : 1;
        const codigoFinal = `${codigoGenerado}-${String(siguienteNumero).padStart(3, '0')}`;
        setFormData({ ...formData, nombre, codigo: codigoFinal });
      } else {
        setFormData({ ...formData, nombre });
      }
    } else {
      setFormData({ ...formData, nombre });
    }
  };

  // Recargar categorías cuando se abre el formulario
  useEffect(() => {
    if (mostrarFormulario) {
      refetchCategorias();
    }
  }, [mostrarFormulario]);

  // Filtrar prendas según la búsqueda
  const prendasFiltradas = prendas.filter(prenda =>
    prenda.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (prenda.codigo && prenda.codigo.toLowerCase().includes(busqueda.toLowerCase())) ||
    (prenda.categoria?.nombre && prenda.categoria.nombre.toLowerCase().includes(busqueda.toLowerCase()))
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
            👕 Gestión de Prendas
          </h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => window.location.href = '/categorias-prendas'}
              style={{ backgroundColor: '#6c757d', borderColor: '#6c757d' }}
            >
              🏷️ Gestionar Categorías
            </button>
            <button className="btn btn-primary" onClick={() => {
              setPrendaEditando(null);
              setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
              setMostrarFormulario(true);
            }}>
              ➕ Nueva Prenda
            </button>
          </div>
        </div>

        {/* Input de búsqueda */}
        <div style={{ marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            className="form-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar prenda por nombre, código o categoría..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          {busqueda && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {prendasFiltradas.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron prendas</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {prendasFiltradas.length} prenda{prendasFiltradas.length !== 1 ? 's' : ''} encontrada{prendasFiltradas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
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
                  onChange={(e) => handleNombreChange(e.target.value)}
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
                  placeholder="Se genera automáticamente basado en el nombre"
                  style={{
                    backgroundColor: prendaEditando ? 'white' : '#f0f0f0',
                    cursor: prendaEditando ? 'text' : 'not-allowed',
                    color: prendaEditando ? 'inherit' : '#666'
                  }}
                  readOnly={!prendaEditando}
                />
                {!prendaEditando && (
                  <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    El código se genera automáticamente al escribir el nombre
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select
                  className="form-select"
                  value={formData.categoria_id}
                  onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                  required
                  disabled={loadingCategorias}
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
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
                    : prendaEditando 
                    ? '💾 Guardar Cambios' 
                    : '➕ Crear Prenda'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setPrendaEditando(null);
                    setFormData({ nombre: '', codigo: '', descripcion: '', categoria_id: '', activo: true });
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
              {prendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busqueda ? 'No se encontraron prendas con ese criterio.' : 'No hay prendas registradas. Crea tu primera prenda.'}
                  </td>
                </tr>
              ) : (
                prendasFiltradas.map((prenda) => (
                  <tr key={prenda.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{prenda.codigo || '-'}</td>
                    <td style={{ fontWeight: '600' }}>{prenda.nombre}</td>
                    <td><span className="badge badge-info">{prenda.categoria?.nombre || '-'}</span></td>
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

'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';
import { supabase } from '@/lib/supabase';
import type { Costo } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function CostosPage() {
  const { sesion } = useAuth();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { costos, loading: costosLoading, error, createCosto, createMultipleCostos, getCostosByPrenda, updateCosto, deleteCosto } = useCostos(sesion?.sucursal_id);
  const { prendas } = usePrendas();
  const { tallas } = useTallas();
  
  // Estado para edición de costo
  const [costoEditando, setCostoEditando] = useState<Costo | null>(null);
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState(false);
  const [formDataEdicion, setFormDataEdicion] = useState({
    precioMayoreo: '',
    precioMenudeo: '',
  });
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  
  const [formData, setFormData] = useState({
    prenda_id: '',
    tallas_seleccionadas: [] as string[],
    precioMayoreo: '',
    precioMenudeo: '',
  });
  
  const [busquedaPrenda, setBusquedaPrenda] = useState('');
  const [mostrarResultadosPrenda, setMostrarResultadosPrenda] = useState(false);
  const [tallasDisponibles, setTallasDisponibles] = useState<string[]>([]);
  const inputPrendaRef = useRef<HTMLInputElement>(null);
  
  // Búsqueda para filtrar la tabla de costos
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [mostrarResultadosTabla, setMostrarResultadosTabla] = useState(false);
  const inputBusquedaTablaRef = useRef<HTMLInputElement>(null);

  // Cargar tallas disponibles cuando se selecciona una prenda
  useEffect(() => {
    const cargarTallasDisponibles = async () => {
      if (formData.prenda_id && sesion?.sucursal_id) {
        // Obtener SOLO los costos de esta prenda EN ESTA SUCURSAL
        const { data, error } = await supabase
          .from('costos')
          .select('talla_id')
          .eq('prenda_id', formData.prenda_id)
          .eq('sucursal_id', sesion.sucursal_id);
        
        if (!error && data && data.length > 0) {
          const tallasIds = data.map(c => c.talla_id);
          setTallasDisponibles(tallasIds);
        } else {
          // Si no hay costos, la prenda no tiene tallas en esta sucursal
          setTallasDisponibles([]);
        }
      } else {
        setTallasDisponibles([]);
        setFormData(prev => ({ ...prev, tallas_seleccionadas: [] }));
      }
    };
    
    cargarTallasDisponibles();
  }, [formData.prenda_id, sesion?.sucursal_id]);

  // Filtrar prendas para búsqueda del formulario
  const prendasFiltradas = prendas
    .filter(p => p.activo)
    .filter(p => {
      if (!busquedaPrenda) return true;
      return p.nombre.toLowerCase().includes(busquedaPrenda.toLowerCase()) ||
             (p.codigo && p.codigo.toLowerCase().includes(busquedaPrenda.toLowerCase()));
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Filtrar prendas para búsqueda de la tabla
  const prendasFiltradasTabla = prendas
    .filter(p => p.activo)
    .filter(p => {
      if (!busquedaTabla) return true;
      return p.nombre.toLowerCase().includes(busquedaTabla.toLowerCase()) ||
             (p.codigo && p.codigo.toLowerCase().includes(busquedaTabla.toLowerCase()));
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Filtrar y ordenar costos
  const costosFiltrados = costos
    .filter(costo => {
      if (!busquedaTabla) return true;
      const prendaNombre = costo.prenda?.nombre?.toLowerCase() || '';
      const prendaCodigo = costo.prenda?.codigo?.toLowerCase() || '';
      const busqueda = busquedaTabla.toLowerCase();
      return prendaNombre.includes(busqueda) || prendaCodigo.includes(busqueda);
    })
    .sort((a, b) => {
      // Ordenar por nombre de prenda ascendente
      const nombreA = a.prenda?.nombre || '';
      const nombreB = b.prenda?.nombre || '';
      if (nombreA !== nombreB) {
        return nombreA.localeCompare(nombreB);
      }
      // Si es la misma prenda, ordenar por talla
      const tallaA = a.talla?.nombre || '';
      const tallaB = b.talla?.nombre || '';
      const aEsNumero = !isNaN(Number(tallaA));
      const bEsNumero = !isNaN(Number(tallaB));
      
      if (aEsNumero && !bEsNumero) return -1;
      if (!aEsNumero && bEsNumero) return 1;
      if (aEsNumero && bEsNumero) {
        return Number(tallaA) - Number(tallaB);
      }
      return tallaA.localeCompare(tallaB);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que se haya seleccionado al menos una talla
    if (formData.tallas_seleccionadas.length === 0) {
      setMensajeError('❌ Por favor selecciona al menos una talla');
      setModalErrorAbierto(true);
      return;
    }
    
    // Verificar qué costos ya existen para esta prenda
    const { data: costosExistentes } = await getCostosByPrenda(formData.prenda_id);
    const tallasConCosto = new Set(
      (costosExistentes || []).map(c => c.talla_id)
    );
    
    // Filtrar solo las tallas que NO tienen costo
    const tallasSinCosto = formData.tallas_seleccionadas.filter(
      talla_id => !tallasConCosto.has(talla_id)
    );
    
    // Si todas las tallas ya tienen costo, mostrar mensaje y salir
    if (tallasSinCosto.length === 0) {
      const tallasExistentes = formData.tallas_seleccionadas
        .map(id => tallas.find(t => t.id === id)?.nombre)
        .filter(Boolean)
        .join(', ');
      setMensajeError(`❌ Todas las tallas seleccionadas (${tallasExistentes}) ya tienen costo registrado para esta prenda.`);
      setModalErrorAbierto(true);
      return;
    }
    
    // Si algunas tallas ya tienen costo, informar al usuario
    if (tallasSinCosto.length < formData.tallas_seleccionadas.length) {
      const tallasYaExistentes = formData.tallas_seleccionadas
        .filter(id => tallasConCosto.has(id))
        .map(id => tallas.find(t => t.id === id)?.nombre)
        .filter(Boolean)
        .join(', ');
      const mensaje = `Las siguientes tallas ya tienen costo: ${tallasYaExistentes}. Se crearán costos solo para las tallas restantes.`;
      if (!confirm(mensaje)) {
        return;
      }
    }
    
    // Crear un costo solo para las tallas que no tienen costo
    const costosData = tallasSinCosto.map(talla_id => ({
      prenda_id: formData.prenda_id,
      talla_id: talla_id,
      precio_venta: parseFloat(formData.precioMenudeo) || 0, // Legacy: usar precio menudeo
      precio_compra: 0,
      precio_mayoreo: parseFloat(formData.precioMayoreo) || 0,
      precio_menudeo: parseFloat(formData.precioMenudeo) || 0,
      stock_inicial: 0,
      stock: 0,
      cantidad_venta: 0,
      stock_minimo: 0,
      activo: true,
    }));

    // Crear todos los costos de una vez usando createMultipleCostos
    const { data, error: errorCrear } = await createMultipleCostos(costosData);
    
    if (errorCrear) {
      setMensajeError(`❌ Error al crear costos: ${errorCrear}`);
      setModalErrorAbierto(true);
      return;
    }
    
    const tallasCreadas = tallasSinCosto
      .map(id => tallas.find(t => t.id === id)?.nombre)
      .filter(Boolean)
      .join(', ');
    
    alert(`${costosData.length} costo(s) creado(s) exitosamente para las tallas: ${tallasCreadas}`);
    
    setFormData({ prenda_id: '', tallas_seleccionadas: [], precioMayoreo: '', precioMenudeo: '' });
    setBusquedaPrenda('');
    setTallasDisponibles([]);
    setMostrarFormulario(false);
  };

  const handleEditarCosto = (costo: Costo) => {
    setCostoEditando(costo);
    setFormDataEdicion({
      precioMayoreo: (costo.precio_mayoreo || 0).toString(),
      precioMenudeo: (costo.precio_menudeo || 0).toString(),
    });
    setBotonEstado('normal');
    setMensajeError('');
    setMostrarModalEdicion(true);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costoEditando) return;

    setBotonEstado('normal');
    
    const { error } = await updateCosto(costoEditando.id, {
      precio_venta: parseFloat(formDataEdicion.precioMenudeo) || 0, // Legacy: usar precio menudeo
      precio_mayoreo: parseFloat(formDataEdicion.precioMayoreo) || 0,
      precio_menudeo: parseFloat(formDataEdicion.precioMenudeo) || 0,
    });

    if (error) {
      setMensajeError(`❌ Error al actualizar costo: ${error}`);
      setModalErrorAbierto(true);
      return;
    }

    setBotonEstado('exito');
    setTimeout(() => {
      setMostrarModalEdicion(false);
      setCostoEditando(null);
      setBotonEstado('normal');
    }, 1500);
  };

  if (costosLoading) {
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
            💰 Costos
          </h1>
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar los costos: {error}
          </div>
        )}

        {/* Búsqueda de prenda para filtrar la tabla */}
        <div style={{ marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto', position: 'relative' }}>
          <input
            ref={inputBusquedaTablaRef}
            type="text"
            className="form-input"
            value={busquedaTabla}
            onChange={(e) => {
              setBusquedaTabla(e.target.value);
              setMostrarResultadosTabla(e.target.value.length > 0);
            }}
            onFocus={() => {
              if (busquedaTabla.length > 0) {
                setMostrarResultadosTabla(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setMostrarResultadosTabla(false), 200);
            }}
            placeholder="🔍 Buscar costo por prenda..."
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
            }}
          />
          
          {/* Dropdown de resultados para la tabla */}
          {mostrarResultadosTabla && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              zIndex: 1000,
              maxHeight: '200px',
              overflowY: 'auto',
              marginTop: '4px'
            }}>
              {prendasFiltradasTabla.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                  No se encontraron prendas
                </div>
              ) : (
                prendasFiltradasTabla.map(prenda => (
                  <div
                    key={prenda.id}
                    onClick={() => {
                      setBusquedaTabla(prenda.nombre);
                      setMostrarResultadosTabla(false);
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    {prenda.nombre} {prenda.codigo && `(${prenda.codigo})`}
                  </div>
                ))
              )}
            </div>
          )}
          
          {busquedaTabla && (
            <div style={{ marginTop: '0.5rem', color: 'white', fontSize: '0.9rem' }}>
              {costosFiltrados.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron costos</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {costosFiltrados.length} costo{costosFiltrados.length !== 1 ? 's' : ''} encontrado{costosFiltrados.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

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
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: '2rem auto',
              position: 'relative'
            }}>
              <h2 className="form-title">Nuevo Costo de Prenda</h2>
              
              <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Prenda *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      ref={inputPrendaRef}
                      type="text"
                      className="form-input"
                      value={busquedaPrenda}
                      onChange={(e) => {
                        setBusquedaPrenda(e.target.value);
                        setMostrarResultadosPrenda(true);
                      }}
                      onFocus={() => {
                        setMostrarResultadosPrenda(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setMostrarResultadosPrenda(false), 200);
                      }}
                      placeholder="🔍 Buscar prenda..."
                      required
                      style={{ width: '100%' }}
                    />
                    
                    {/* Dropdown de resultados */}
                    {mostrarResultadosPrenda && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        maxHeight: '300px',
                        overflowY: 'auto',
                        marginTop: '4px'
                      }}>
                        {prendasFiltradas.length === 0 ? (
                          <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                            No se encontraron prendas
                          </div>
                        ) : (
                          prendasFiltradas.map(prenda => (
                            <div
                              key={prenda.id}
                              onClick={() => {
                                setFormData({ ...formData, prenda_id: prenda.id, tallas_seleccionadas: [] });
                                setBusquedaPrenda(prenda.nombre);
                                setMostrarResultadosPrenda(false);
                              }}
                              style={{
                                padding: '0.75rem 1rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                transition: 'background-color 0.2s',
                                backgroundColor: formData.prenda_id === prenda.id ? '#e7f3ff' : 'white'
                              }}
                              onMouseEnter={(e) => {
                                if (formData.prenda_id !== prenda.id) {
                                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (formData.prenda_id !== prenda.id) {
                                  e.currentTarget.style.backgroundColor = 'white';
                                } else {
                                  e.currentTarget.style.backgroundColor = '#e7f3ff';
                                }
                              }}
                            >
                              {prenda.nombre} {prenda.codigo && `(${prenda.codigo})`}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tallas *</label>
                  {!formData.prenda_id ? (
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: '8px',
                      color: '#999',
                      textAlign: 'center'
                    }}>
                      Primero selecciona una prenda
                    </div>
                  ) : tallasDisponibles.length === 0 ? (
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#fff3cd', 
                      borderRadius: '8px',
                      color: '#856404',
                      textAlign: 'center'
                    }}>
                      Esta prenda no tiene tallas asociadas
                    </div>
                  ) : (
                    <div style={{ 
                      border: '1px solid #ddd', 
                      borderRadius: '8px', 
                      overflow: 'hidden',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {(() => {
                            // Filtrar solo las tallas disponibles para esta prenda
                            const tallasFiltradas = tallas
                              .filter(t => t.activo && tallasDisponibles.includes(t.id))
                              .sort((a, b) => {
                                const aEsNumero = !isNaN(Number(a.nombre));
                                const bEsNumero = !isNaN(Number(b.nombre));
                                
                                if (aEsNumero && !bEsNumero) return -1;
                                if (!aEsNumero && bEsNumero) return 1;
                                if (aEsNumero && bEsNumero) {
                                  return Number(a.nombre) - Number(b.nombre);
                                }
                                return a.nombre.localeCompare(b.nombre);
                              });
                            
                            // Dividir en filas de 4 columnas
                            const filas = [];
                            for (let i = 0; i < tallasFiltradas.length; i += 4) {
                              filas.push(tallasFiltradas.slice(i, i + 4));
                            }
                            
                            if (filas.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                                    No hay tallas disponibles
                                  </td>
                                </tr>
                              );
                            }
                            
                            return filas.map((fila, filaIndex) => (
                              <tr key={filaIndex} style={{ borderBottom: filaIndex < filas.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                {fila.map(talla => (
                                  <td 
                                    key={talla.id} 
                                    style={{ 
                                      padding: '0.75rem',
                                      width: '25%',
                                      borderRight: fila.indexOf(talla) < fila.length - 1 ? '1px solid #f0f0f0' : 'none'
                                    }}
                                  >
                                    <label style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '0.5rem',
                                      cursor: 'pointer',
                                      userSelect: 'none'
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={formData.tallas_seleccionadas.includes(talla.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({ 
                                              ...formData, 
                                              tallas_seleccionadas: [...formData.tallas_seleccionadas, talla.id]
                                            });
                                          } else {
                                            setFormData({ 
                                              ...formData, 
                                              tallas_seleccionadas: formData.tallas_seleccionadas.filter(id => id !== talla.id)
                                            });
                                          }
                                        }}
                                        style={{ 
                                          width: '18px', 
                                          height: '18px', 
                                          cursor: 'pointer' 
                                        }}
                                      />
                                      <span style={{ 
                                        fontWeight: formData.tallas_seleccionadas.includes(talla.id) ? '600' : '400',
                                        color: formData.tallas_seleccionadas.includes(talla.id) ? '#007bff' : 'inherit'
                                      }}>
                                        {talla.nombre}
                                      </span>
                                    </label>
                                  </td>
                                ))}
                                {/* Rellenar celdas vacías si la última fila no tiene 4 elementos */}
                                {Array.from({ length: 4 - fila.length }).map((_, index) => (
                                  <td key={`empty-${index}`} style={{ padding: '0.75rem', width: '25%' }}></td>
                                ))}
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {formData.tallas_seleccionadas.length > 0 && (
                    <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
                      {formData.tallas_seleccionadas.length} talla{formData.tallas_seleccionadas.length !== 1 ? 's' : ''} seleccionada{formData.tallas_seleccionadas.length !== 1 ? 's' : ''}. Los precios que ingreses se aplicarán a todas las tallas seleccionadas.
                    </small>
                  )}
                </div>

                {formData.tallas_seleccionadas.length > 0 && (
                  <>
                    <div className="form-group">
                      <label className="form-label">📦 Precio Mayoreo *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={formData.precioMayoreo}
                        onChange={(e) => setFormData({ ...formData, precioMayoreo: e.target.value })}
                        placeholder="$0.00"
                        required
                        style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                      />
                      <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                        Precio de venta al por mayor (pedidos grandes)
                      </small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">🛍️ Precio Menudeo *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={formData.precioMenudeo}
                        onChange={(e) => setFormData({ ...formData, precioMenudeo: e.target.value })}
                        placeholder="$0.00"
                        required
                        style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                      />
                      <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                        Precio de venta al detalle/menudeo
                      </small>
                    </div>

                    {formData.tallas_seleccionadas.length > 1 && (
                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#e7f3ff', 
                        borderRadius: '8px',
                        borderLeft: '4px solid #007bff'
                      }}>
                        <small style={{ color: '#0056b3', fontSize: '0.9rem', display: 'block' }}>
                          💡 Se crearán {formData.tallas_seleccionadas.length} costos con estos precios para cada talla seleccionada.
                        </small>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary">
                  💾 Guardar Costo
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarFormulario(false)}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
            </div>
          </div>
        )}

        <div className="table-container">
          <div style={{ marginBottom: '1rem', textAlign: 'right', padding: '0 1rem' }}>
            <button className="btn btn-primary" onClick={() => {
              setMostrarFormulario(!mostrarFormulario);
              setBotonEstado('normal');
              setMensajeError('');
              if (!mostrarFormulario) {
                setFormData({ prenda_id: '', tallas_seleccionadas: [], precioMayoreo: '', precioMenudeo: '' });
                setBusquedaPrenda('');
              }
            }} style={{ minWidth: '200px' }}>
              ➕ Nuevo Costo
            </button>
          </div>
          
          <table className="table">
            <thead>
              <tr>
                <th>Prenda</th>
                <th>Talla</th>
                <th>📦 Mayoreo</th>
                <th>🛍️ Menudeo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {costosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busquedaTabla ? 'No se encontraron costos con ese criterio.' : 'No hay costos registrados. Crea tu primer costo.'}
                  </td>
                </tr>
              ) : (
                costosFiltrados.map((costo: any) => (
                  <tr key={costo.id}>
                    <td data-label="Prenda" style={{ fontWeight: '600' }}>{costo.prenda?.nombre || '-'}</td>
                    <td data-label="Talla"><span className="badge badge-info">{costo.talla?.nombre || '-'}</span></td>
                    <td data-label="📦 Mayoreo" style={{ fontWeight: '600', color: '#3b82f6' }}>
                      ${(costo.precio_mayoreo || 0).toFixed(2)}
                    </td>
                    <td data-label="🛍️ Menudeo" style={{ fontWeight: '600', color: '#10b981' }}>
                      ${(costo.precio_menudeo || 0).toFixed(2)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => handleEditarCosto(costo)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={async () => {
                            if (confirm('⚠️ ¿Estás seguro de eliminar este costo? Esta acción NO se puede deshacer.')) {
                              const { error } = await deleteCosto(costo.id);
                              if (error) {
                                setMensajeError(`❌ Error al eliminar: ${error}`);
                                setModalErrorAbierto(true);
                              }
                            }
                          }}
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

        {/* Modal de Edición de Costo */}
        {mostrarModalEdicion && costoEditando && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
            overflowY: 'auto'
          }}>
            <div className="form-container" style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: '2rem auto',
              position: 'relative'
            }}>
              <h2 className="form-title">
                Editar Costo - {costoEditando.prenda?.nombre} ({costoEditando.talla?.nombre})
              </h2>
              
              <form onSubmit={handleGuardarEdicion}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">📦 Precio Mayoreo *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={formDataEdicion.precioMayoreo}
                      onChange={(e) => setFormDataEdicion({ ...formDataEdicion, precioMayoreo: e.target.value })}
                      placeholder="$0.00"
                      required
                      style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                    />
                    <small style={{ color: '#888', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                      Precio de venta al por mayor (pedidos grandes)
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">🛍️ Precio Menudeo *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={formDataEdicion.precioMenudeo}
                      onChange={(e) => setFormDataEdicion({ ...formDataEdicion, precioMenudeo: e.target.value })}
                      placeholder="$0.00"
                      required
                      style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                    />
                    <small style={{ color: '#888', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                      Precio de venta al detalle/menudeo
                    </small>
                  </div>
                </div>

                <div className="btn-group">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{
                      backgroundColor: botonEstado === 'exito' ? '#28a745' : undefined,
                      color: botonEstado === 'exito' ? 'white' : undefined,
                      borderColor: botonEstado === 'exito' ? '#28a745' : undefined
                    }}
                  >
                    {botonEstado === 'exito' ? '✓ Guardado' : '💾 Guardar Cambios'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarModalEdicion(false);
                      setCostoEditando(null);
                      setBotonEstado('normal');
                    }}
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Error */}
      {modalErrorAbierto && (
        <div style={{
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
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              color: '#dc3545', 
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>
              Error
            </h3>
            <p style={{ 
              color: '#333', 
              marginBottom: '2rem',
              fontSize: '1.1rem',
              lineHeight: '1.5'
            }}>
              {mensajeError}
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setModalErrorAbierto(false);
                setMensajeError('');
                setMostrarFormulario(false);
                setMostrarModalEdicion(false);
                setCostoEditando(null);
                setFormData({ prenda_id: '', tallas_seleccionadas: [], precioMayoreo: '', precioMenudeo: '' });
                setFormDataEdicion({ precioMayoreo: '', precioMenudeo: '' });
                setBusquedaPrenda('');
                setBotonEstado('normal');
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
}

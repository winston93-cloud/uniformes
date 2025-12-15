'use client';

import { useState, useEffect, useRef } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';
import { supabase } from '@/lib/supabase';
import type { Costo } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function StockPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { costos, loading: costosLoading, error, getCostosByPrenda, updateCosto } = useCostos();
  const { prendas } = usePrendas();
  const { tallas } = useTallas();
  
  const [formData, setFormData] = useState({
    prenda_id: '',
    tallas_seleccionadas: [] as string[],
    stocksPorTalla: {} as Record<string, string>, // Stock inicial por talla
    stocksMinimosPorTalla: {} as Record<string, string>, // Stock mínimo por talla
  });
  
  const [busquedaPrenda, setBusquedaPrenda] = useState('');
  const [mostrarResultadosPrenda, setMostrarResultadosPrenda] = useState(false);
  const [tallasDisponibles, setTallasDisponibles] = useState<string[]>([]);
  const inputPrendaRef = useRef<HTMLInputElement>(null);
  
  // Búsqueda para filtrar la tabla de stock
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [mostrarResultadosTabla, setMostrarResultadosTabla] = useState(false);
  const inputBusquedaTablaRef = useRef<HTMLInputElement>(null);
  const [botonEstado, setBotonEstado] = useState<'normal' | 'exito' | 'error'>('normal');

  // Cargar tallas disponibles cuando se selecciona una prenda
  useEffect(() => {
    const cargarTallasDisponibles = async () => {
      if (formData.prenda_id) {
        const { data } = await getCostosByPrenda(formData.prenda_id);
        if (data) {
          const tallasIds = data.map(c => c.talla_id);
          setTallasDisponibles(tallasIds);
        } else {
          setTallasDisponibles([]);
        }
      } else {
        setTallasDisponibles([]);
        setFormData(prev => ({ ...prev, tallas_seleccionadas: [], stocksPorTalla: {}, stocksMinimosPorTalla: {} }));
      }
    };
    
    cargarTallasDisponibles();
  }, [formData.prenda_id]);

  // Auto-focus en el input de búsqueda al cargar
  useEffect(() => {
    if (inputBusquedaTablaRef.current) {
      inputBusquedaTablaRef.current.focus();
    }
  }, []);

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

  // Filtrar y ordenar costos para mostrar stock
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
      alert('Por favor selecciona al menos una talla');
      return;
    }
    
    setBotonEstado('normal');
    
    // Verificar qué costos ya existen para esta prenda
    const { data: costosExistentes } = await getCostosByPrenda(formData.prenda_id);
    const costosPorTalla = new Map(
      (costosExistentes || []).map(c => [c.talla_id, c])
    );
    
    let exitosos = 0;
    let fallidos = 0;
    
    // Actualizar o crear stock para cada talla seleccionada
    for (const talla_id of formData.tallas_seleccionadas) {
      const stockValue = parseInt(formData.stocksPorTalla[talla_id] || '0') || 0;
      const stockMinimoValue = parseInt(formData.stocksMinimosPorTalla[talla_id] || '0') || 0;
      
      if (costosPorTalla.has(talla_id)) {
        // Actualizar stock existente
        const costoExistente = costosPorTalla.get(talla_id)!;
        const { error } = await updateCosto(costoExistente.id, {
          stock: stockValue,
          stock_inicial: stockValue,
          stock_minimo: stockMinimoValue,
        });
        
        if (error) {
          fallidos++;
        } else {
          exitosos++;
        }
      } else {
        // Crear nuevo costo con stock inicial
        const { error } = await supabase
          .from('costos')
          .insert([{
            prenda_id: formData.prenda_id,
            talla_id: talla_id,
            precio_venta: 0,
            stock_inicial: stockValue,
            stock: stockValue,
            stock_minimo: stockMinimoValue,
            activo: true,
          }]);
        
        if (error) {
          fallidos++;
        } else {
          exitosos++;
        }
      }
    }
    
    if (exitosos > 0) {
      setBotonEstado('exito');
      setTimeout(() => {
        setFormData({ prenda_id: '', tallas_seleccionadas: [], stocksPorTalla: {}, stocksMinimosPorTalla: {} });
        setBusquedaPrenda('');
        setTallasDisponibles([]);
        setMostrarFormulario(false);
        setBotonEstado('normal');
      }, 1500);
    } else {
      setBotonEstado('error');
      setTimeout(() => setBotonEstado('normal'), 2000);
    }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            📦 Stock
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Asignar Stock
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            Error al cargar el stock: {error}
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
            placeholder="🔍 Buscar stock por prenda..."
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
                <span style={{ color: '#ff6b6b' }}>❌ No se encontró stock</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {costosFiltrados.length} registro{costosFiltrados.length !== 1 ? 's' : ''} encontrado{costosFiltrados.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {mostrarFormulario && (
          <div className="form-container">
            <h2 className="form-title">Asignar Stock Inicial</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
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
                                setFormData({ ...formData, prenda_id: prenda.id, tallas_seleccionadas: [], stocksPorTalla: {} });
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

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
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
                      Esta prenda no tiene tallas asociadas. Primero crea un costo para esta prenda.
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
                                              tallas_seleccionadas: [...formData.tallas_seleccionadas, talla.id],
                                              stocksPorTalla: {
                                                ...formData.stocksPorTalla,
                                                [talla.id]: '0'
                                              },
                                              stocksMinimosPorTalla: {
                                                ...formData.stocksMinimosPorTalla,
                                                [talla.id]: '0'
                                              }
                                            });
                                          } else {
                                            const newStocksPorTalla = { ...formData.stocksPorTalla };
                                            const newStocksMinimosPorTalla = { ...formData.stocksMinimosPorTalla };
                                            delete newStocksPorTalla[talla.id];
                                            delete newStocksMinimosPorTalla[talla.id];
                                            setFormData({ 
                                              ...formData, 
                                              tallas_seleccionadas: formData.tallas_seleccionadas.filter(id => id !== talla.id),
                                              stocksPorTalla: newStocksPorTalla,
                                              stocksMinimosPorTalla: newStocksMinimosPorTalla
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
                      {formData.tallas_seleccionadas.length} talla{formData.tallas_seleccionadas.length !== 1 ? 's' : ''} seleccionada{formData.tallas_seleccionadas.length !== 1 ? 's' : ''}. Especifica el stock inicial para cada talla.
                    </small>
                  )}
                </div>

                {formData.tallas_seleccionadas.length > 0 && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Stock Inicial por Talla *</label>
                    <div style={{ 
                      border: '1px solid #ddd', 
                      borderRadius: '8px', 
                      overflow: 'hidden',
                      backgroundColor: 'white'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Talla</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Stock Inicial</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Stock Mínimo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.tallas_seleccionadas.map(talla_id => {
                            const talla = tallas.find(t => t.id === talla_id);
                            return (
                              <tr key={talla_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '0.75rem', fontWeight: '600' }}>
                                  {talla?.nombre || '-'}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <input
                                    type="number"
                                    className="form-input"
                                    value={formData.stocksPorTalla[talla_id] || '0'}
                                    onChange={(e) => {
                                      setFormData({
                                        ...formData,
                                        stocksPorTalla: {
                                          ...formData.stocksPorTalla,
                                          [talla_id]: e.target.value
                                        }
                                      });
                                    }}
                                    placeholder="0"
                                    required
                                    min="0"
                                    style={{ width: '100%', maxWidth: '200px' }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <input
                                    type="number"
                                    className="form-input"
                                    value={formData.stocksMinimosPorTalla[talla_id] || '0'}
                                    onChange={(e) => {
                                      setFormData({
                                        ...formData,
                                        stocksMinimosPorTalla: {
                                          ...formData.stocksMinimosPorTalla,
                                          [talla_id]: e.target.value
                                        }
                                      });
                                    }}
                                    placeholder="0"
                                    min="0"
                                    style={{ width: '100%', maxWidth: '200px' }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="btn-group">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{
                    backgroundColor: botonEstado === 'exito' ? '#10b981' : botonEstado === 'error' ? '#ef4444' : undefined,
                    color: (botonEstado === 'exito' || botonEstado === 'error') ? 'white' : undefined
                  }}
                >
                  {botonEstado === 'exito' ? '✓ Stock Asignado' : botonEstado === 'error' ? '✕ Error' : '💾 Asignar Stock'}
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
        )}

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Prenda</th>
                <th>Talla</th>
                <th>Stock</th>
                <th>Stock de Reabastecimiento</th>
                <th>Stock Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {costosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busquedaTabla ? 'No se encontró stock con ese criterio.' : 'No hay stock registrado. Asigna stock inicial a las prendas.'}
                  </td>
                </tr>
              ) : (
                costosFiltrados.map((costo: any) => (
                  <tr key={costo.id}>
                    <td style={{ fontWeight: '600' }}>{costo.prenda?.nombre || '-'}</td>
                    <td><span className="badge badge-info">{costo.talla?.nombre || '-'}</span></td>
                    <td>{costo.stock_inicial}</td>
                    <td style={{ fontWeight: '600', color: costo.stock > 0 ? '#10b981' : '#ef4444' }}>
                      {costo.stock}
                    </td>
                    <td style={{ fontWeight: '600', color: costo.stock_minimo ? '#f59e0b' : '#999' }}>
                      {costo.stock_minimo || 0}
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


'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';
import ModalCostosPrenda, { agruparCostosPorPrenda, resumenRangoPrecios } from '@/components/ModalCostosPrenda';
import { compararTallas } from '@/lib/ordenTallas';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Costo } from '@/lib/types';
import { opcionesInventarioDesdeSesion } from '@/lib/inventarioSucursal';
import { esCuentaWinston } from '@/lib/winstonLineaVenta';

export const dynamic = 'force-dynamic';

export default function CostosPage() {
  const { sesion } = useAuth();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const inventarioOpts = opcionesInventarioDesdeSesion(sesion, 'gestion');
  const puedeEditarCatalogo = Boolean(sesion?.es_matriz) || esCuentaWinston(sesion);
  const { costos, loading: costosLoading, error, createCosto, updateCosto, deleteCosto } = useCostos(
    sesion?.sucursal_id,
    sesion?.es_matriz,
    {
      catalogoCompleto: inventarioOpts.catalogoCompleto,
      incluirStockCero: inventarioOpts.incluirStockCero,
    }
  );
  const { prendas } = usePrendas(inventarioOpts);
  const { tallas } = useTallas();
  
  // Estado para edición agrupada por prenda
  const [grupoEditando, setGrupoEditando] = useState<{
    prenda_id: string;
    prenda: Costo['prenda'];
    costos: Costo[];
  } | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [mensajeError, setMensajeError] = useState<string>('');
  const [modalErrorAbierto, setModalErrorAbierto] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string>('');
  const [modalExitoAbierto, setModalExitoAbierto] = useState(false);
  
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
        // Obtener las tallas asociadas a esta prenda EN LA SUCURSAL ACTUAL
        // Estas son las tallas que se pueden configurar con precios
        const { data, error } = await insforgeDb()
          .from('costos')
          .select('talla_id')
          .eq('prenda_id', formData.prenda_id)
          .eq('sucursal_id', sesion.sucursal_id);
        
        if (!error && data && data.length > 0) {
          // Obtener IDs únicos de tallas
          const tallasIdsUnicos = Array.from(new Set(data.map(c => c.talla_id)));
          setTallasDisponibles(tallasIdsUnicos);
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

  const costosFiltrados = useMemo(
    () =>
      costos.filter((costo) => {
        if (costo.activo === false) return false;
        if (!busquedaTabla) return true;
        const prendaNombre = costo.prenda?.nombre?.toLowerCase() || '';
        const prendaCodigo = costo.prenda?.codigo?.toLowerCase() || '';
        const busqueda = busquedaTabla.toLowerCase();
        return prendaNombre.includes(busqueda) || prendaCodigo.includes(busqueda);
      }),
    [costos, busquedaTabla]
  );

  const prendasAgrupadas = useMemo(
    () => agruparCostosPorPrenda(costosFiltrados),
    [costosFiltrados]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que se haya seleccionado al menos una talla
    if (formData.tallas_seleccionadas.length === 0) {
      setMensajeError('❌ Por favor selecciona al menos una talla');
      setModalErrorAbierto(true);
      return;
    }
    
    if (!sesion?.sucursal_id) {
      setMensajeError('❌ Error: No hay sucursal activa');
      setModalErrorAbierto(true);
      return;
    }
    
    // Obtener costos existentes para esta prenda EN ESTA SUCURSAL
    const { data: costosExistentes } = await insforgeDb()
      .from('costos')
      .select('*')
      .eq('prenda_id', formData.prenda_id)
      .eq('sucursal_id', sesion.sucursal_id);
    
    const costosMap = new Map(
      (costosExistentes || []).map(c => [c.talla_id, c])
    );
    
    let actualizados = 0;
    let creados = 0;
    
    // Para cada talla seleccionada, UPDATE o INSERT
    for (const talla_id of formData.tallas_seleccionadas) {
      const costoExistente = costosMap.get(talla_id);
      
      const datosPrecios = {
        precio_venta: parseFloat(formData.precioMenudeo) || 0,
        precio_compra: 0,
        precio_mayoreo: parseFloat(formData.precioMayoreo) || 0,
        precio_menudeo: parseFloat(formData.precioMenudeo) || 0,
      };
      
      if (costoExistente) {
        // UPDATE del costo existente
        const { error } = await updateCosto(costoExistente.id, datosPrecios);
        if (error) {
          setMensajeError(`❌ Error al actualizar: ${error}`);
          setModalErrorAbierto(true);
          return;
        }
        actualizados++;
      } else {
        // INSERT de nuevo costo
        const nuevoCosto = {
          prenda_id: formData.prenda_id,
          talla_id: talla_id,
          sucursal_id: sesion.sucursal_id,
          ...datosPrecios,
          stock_inicial: 0,
          stock: 0,
          cantidad_venta: 0,
          stock_minimo: 0,
          activo: true,
        };
        
        const { error } = await createCosto(nuevoCosto);
        if (error) {
          setMensajeError(`❌ Error al crear: ${error}`);
          setModalErrorAbierto(true);
          return;
        }
        creados++;
      }
    }
    
    setMensajeExito(`✓ ${creados} costo(s) creado(s), ${actualizados} actualizado(s)`);
    setModalExitoAbierto(true);
    
    setTimeout(() => {
      setModalExitoAbierto(false);
      setMensajeExito('');
      setFormData({ prenda_id: '', tallas_seleccionadas: [], precioMayoreo: '', precioMenudeo: '' });
      setBusquedaPrenda('');
      setTallasDisponibles([]);
      setMostrarFormulario(false);
    }, 2000);
  };

  const handleEditarPrenda = (grupo: (typeof prendasAgrupadas)[number]) => {
    setGrupoEditando({
      prenda_id: grupo.prenda_id,
      prenda: grupo.prenda,
      costos: grupo.costos,
    });
  };

  const handleGuardarPreciosPrenda = async (
    cambios: Array<{ id: string; precio_mayoreo: number; precio_menudeo: number; precio_venta: number }>
  ) => {
    setGuardandoEdicion(true);
    try {
      for (const c of cambios) {
        const { error } = await updateCosto(c.id, {
          precio_mayoreo: c.precio_mayoreo,
          precio_menudeo: c.precio_menudeo,
          precio_venta: c.precio_venta,
        });
        if (error) return { ok: false, error };
      }
      return { ok: true };
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleEliminarCostoTalla = async (costoId: string) => {
    const { error, message } = await deleteCosto(costoId);
    if (error) return { ok: false, error };
    if (grupoEditando) {
      const restantes = grupoEditando.costos.filter((c) => c.id !== costoId);
      if (restantes.length === 0) {
        setGrupoEditando(null);
      } else {
        setGrupoEditando({ ...grupoEditando, costos: restantes });
      }
    }
    return { ok: true, info: message ?? undefined };
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
            placeholder="🔍 Buscar prenda en catálogo de costos..."
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
              {prendasAgrupadas.length === 0 ? (
                <span style={{ color: '#ff6b6b' }}>❌ No se encontraron prendas</span>
              ) : (
                <span style={{ color: '#51cf66' }}>
                  ✓ {prendasAgrupadas.length} prenda{prendasAgrupadas.length !== 1 ? 's' : ''} ·{' '}
                  {costosFiltrados.length} talla{costosFiltrados.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {mostrarFormulario && (
          <div
            style={{
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
              overflowY: 'auto',
            }}
          >
            <div
              className="form-container"
              style={{
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: '2rem auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
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
                              .sort(compararTallas);
                            
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
            {puedeEditarCatalogo && (
            <button className="btn btn-primary" onClick={() => {
              setMostrarFormulario(!mostrarFormulario);
              setMensajeError('');
              if (!mostrarFormulario) {
                setFormData({ prenda_id: '', tallas_seleccionadas: [], precioMayoreo: '', precioMenudeo: '' });
                setBusquedaPrenda('');
              }
            }} style={{ minWidth: '200px' }}>
              ➕ Nuevo Costo
            </button>
            )}
          </div>
          
          <table className="table">
            <thead>
              <tr>
                <th>Prenda</th>
                <th>Tallas</th>
                <th>📦 Mayoreo</th>
                <th>🛍️ Menudeo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prendasAgrupadas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    {busquedaTabla
                      ? 'No se encontraron prendas con ese criterio.'
                        : puedeEditarCatalogo
                          ? 'No hay costos registrados. Crea tu primer costo.'
                          : 'No hay costos en esta sucursal. Aparecerán cuando recibas transferencias desde matriz.'}
                  </td>
                </tr>
              ) : (
                prendasAgrupadas.map((grupo) => {
                  const nTallas = grupo.costos.length;
                  const mayoreoResumen = resumenRangoPrecios(grupo.costos, 'precio_mayoreo');
                  const menudeoResumen = resumenRangoPrecios(grupo.costos, 'precio_menudeo');
                  const preciosUniformes =
                    grupo.costos.every(
                      (c) =>
                        (c.precio_mayoreo ?? 0) === (grupo.costos[0].precio_mayoreo ?? 0) &&
                        (c.precio_menudeo ?? 0) === (grupo.costos[0].precio_menudeo ?? 0)
                    );
                  return (
                    <tr key={grupo.prenda_id}>
                      <td data-label="Prenda" style={{ fontWeight: '700' }}>
                        {grupo.prenda?.nombre || '-'}
                        {grupo.prenda?.codigo ? (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {grupo.prenda.codigo}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Tallas">
                        <span className="badge badge-info">{nTallas} talla{nTallas !== 1 ? 's' : ''}</span>
                        {!preciosUniformes ? (
                          <span
                            style={{
                              marginLeft: '0.4rem',
                              fontSize: '0.72rem',
                              color: '#b45309',
                              fontWeight: 600,
                            }}
                          >
                            precios mixtos
                          </span>
                        ) : null}
                      </td>
                      <td data-label="📦 Mayoreo" style={{ fontWeight: '600', color: '#3b82f6' }}>
                        {mayoreoResumen}
                      </td>
                      <td data-label="🛍️ Menudeo" style={{ fontWeight: '600', color: '#10b981' }}>
                        {menudeoResumen}
                      </td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #f97316, #ea580c)',
                          }}
                          onClick={() => handleEditarPrenda(grupo)}
                        >
                          ✏️ Editar precios
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <ModalCostosPrenda
          abierto={Boolean(grupoEditando)}
          prendaNombre={grupoEditando?.prenda?.nombre || 'Prenda'}
          prendaCodigo={grupoEditando?.prenda?.codigo}
          costos={grupoEditando?.costos || []}
          guardando={guardandoEdicion}
          onClose={() => setGrupoEditando(null)}
          onGuardar={handleGuardarPreciosPrenda}
          onEliminarTalla={(id) => handleEliminarCostoTalla(id)}
        />
      </div>

      {/* Modal de Error */}
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
                setGrupoEditando(null);
                setFormData({ prenda_id: '', tallas_seleccionadas: [], precioMayoreo: '', precioMenudeo: '' });
                setBusquedaPrenda('');
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

      {/* Modal de Éxito */}
      {modalExitoAbierto && (
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
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              ✓
            </div>
            <h3 style={{ 
              color: '#28a745', 
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>
              Éxito
            </h3>
            <p style={{ 
              color: '#333', 
              fontSize: '1.1rem',
              lineHeight: '1.5'
            }}>
              {mensajeExito}
            </p>
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
}

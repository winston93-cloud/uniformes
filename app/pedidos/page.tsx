'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';
import { useAlumnos } from '@/lib/hooks/useAlumnos';
import { useExternos } from '@/lib/hooks/useExternos';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';

interface Pedido {
  id: number;
  fecha: string;
  cliente: string;
  tipoCliente: 'alumno' | 'externo';
  total: number;
  estado: 'PEDIDO' | 'ENTREGADO' | 'LIQUIDADO' | 'CANCELADO';
}

interface DetallePedido {
  prenda: string;
  prenda_id: string;
  talla: string;
  talla_id: string;
  especificaciones: string;
  cantidad: number;
  pendiente: number;
  precio: number;
  total: number;
  costoId?: string;
}

export const dynamic = 'force-dynamic';

export default function PedidosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { costos, getCostosByPrenda } = useCostos();
  const { alumnos, searchAlumnos } = useAlumnos();
  const { externos } = useExternos();
  const { prendas } = usePrendas();
  const { tallas } = useTallas();
  
  const [pedidos, setPedidos] = useState<Pedido[]>([
    { id: 1, fecha: '2024-11-19', cliente: 'Juan Pérez', tipoCliente: 'alumno', total: 750, estado: 'PEDIDO' },
    { id: 2, fecha: '2024-11-18', cliente: 'María García', tipoCliente: 'alumno', total: 1200, estado: 'ENTREGADO' },
    { id: 3, fecha: '2024-11-17', cliente: 'Pedro López', tipoCliente: 'externo', total: 950, estado: 'LIQUIDADO' },
  ]);

  const [formData, setFormData] = useState({
    cliente_id: '',
    cliente_tipo: '' as 'alumno' | 'externo' | '',
    cliente_nombre: '',
    detalles: [] as DetallePedido[],
    observaciones: '',
    modalidad_pago: 'TOTAL' as 'TOTAL' | 'ANTICIPO',
    efectivo_recibido: 0,
  });

  // Estados para búsqueda de cliente
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Array<{
    id: string;
    nombre: string;
    tipo: 'alumno' | 'externo';
    datos: any;
  }>>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const inputClienteRef = useRef<HTMLInputElement>(null);

  const [detalleActual, setDetalleActual] = useState({
    prenda_id: '',
    prenda_nombre: '',
    talla_id: '',
    talla_nombre: '',
    especificaciones: '',
    cantidad: '0',
    precio: '0',
  });

  // Estados NUEVOS para búsqueda de prendas (implementación desde cero)
  const [textoPrendaBusqueda, setTextoPrendaBusqueda] = useState('');
  const [prendasEncontradas, setPrendasEncontradas] = useState<any[]>([]);
  const [mostrarListaPrendas, setMostrarListaPrendas] = useState(false);
  const [tallasDisponibles, setTallasDisponibles] = useState<any[]>([]);
  const inputPrendaRef = useRef<HTMLInputElement>(null);
  const contenedorPrendaRef = useRef<HTMLDivElement>(null);

  // Función para buscar clientes (alumnos y externos)
  useEffect(() => {
    let isMounted = true;
    
    const buscarClientes = async () => {
      if (busquedaCliente.trim().length < 2) {
        if (isMounted) {
          setResultadosBusqueda([]);
          setMostrarResultados(false);
        }
        return;
      }

      const query = busquedaCliente.trim().toLowerCase();
      const resultados: Array<{
        id: string;
        nombre: string;
        tipo: 'alumno' | 'externo';
        datos: any;
      }> = [];

      try {
        // Buscar en alumnos
        const alumnosEncontrados = await searchAlumnos(query);
        if (isMounted && alumnosEncontrados) {
          alumnosEncontrados.slice(0, 10).forEach(alumno => {
            resultados.push({
              id: alumno.id,
              nombre: alumno.nombre,
              tipo: 'alumno',
              datos: alumno,
            });
          });
        }

        // Buscar en externos
        const externosFiltrados = externos
          .filter(e => e.activo && (
            e.nombre.toLowerCase().includes(query) ||
            (e.email && e.email.toLowerCase().includes(query)) ||
            (e.telefono && e.telefono.includes(query))
          ))
          .slice(0, 10 - resultados.length);

        externosFiltrados.forEach(externo => {
          resultados.push({
            id: externo.id,
            nombre: externo.nombre,
            tipo: 'externo',
            datos: externo,
          });
        });

        if (isMounted) {
          setResultadosBusqueda(resultados.slice(0, 10));
          setMostrarResultados(resultados.length > 0);
        }
      } catch (error) {
        console.error('Error buscando clientes:', error);
        if (isMounted) {
          setResultadosBusqueda([]);
          setMostrarResultados(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      buscarClientes();
    }, 300); // Debounce de 300ms

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaCliente]);

  const seleccionarCliente = (cliente: typeof resultadosBusqueda[0]) => {
    setFormData({
      ...formData,
      cliente_id: cliente.id,
      cliente_tipo: cliente.tipo,
      cliente_nombre: cliente.nombre,
    });
    setClienteSeleccionado(cliente.datos);
    setBusquedaCliente(cliente.nombre);
    setMostrarResultados(false);
  };

  // NUEVA IMPLEMENTACIÓN: Búsqueda simple y directa de prendas
  const ejecutarBusquedaPrenda = (texto: string) => {
    console.log('🆕 Búsqueda nueva - texto:', texto);
    
    if (!texto || texto.trim().length < 2) {
      setPrendasEncontradas([]);
      setMostrarListaPrendas(false);
      return;
    }

    const textoMinuscula = texto.trim().toLowerCase();
    const resultados = prendas
      .filter(prenda => 
        prenda.activo && 
        (prenda.nombre.toLowerCase().includes(textoMinuscula) || 
         (prenda.codigo && prenda.codigo.toLowerCase().includes(textoMinuscula)))
      )
      .slice(0, 10);

    console.log('✨ Resultados encontrados:', resultados.length, resultados.map(p => p.nombre));
    setPrendasEncontradas(resultados);
    setMostrarListaPrendas(resultados.length > 0);
  };

  // NUEVA: Manejar cambio en el input de búsqueda
  const handleCambioBusquedaPrenda = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoTexto = e.target.value;
    setTextoPrendaBusqueda(nuevoTexto);
    ejecutarBusquedaPrenda(nuevoTexto);
  };

  // NUEVA: Seleccionar una prenda del dropdown
  const seleccionarPrendaDelDropdown = async (prenda: any) => {
    console.log('🎯 Prenda seleccionada:', prenda.nombre);
    
    setTextoPrendaBusqueda(prenda.nombre);
    setDetalleActual({
      ...detalleActual,
      prenda_id: prenda.id,
      prenda_nombre: prenda.nombre,
      talla_id: '',
      talla_nombre: '',
      precio: '0',
    });
    setMostrarListaPrendas(false);
    
    // Cargar tallas asociadas a esta prenda
    const { data } = await getCostosByPrenda(prenda.id);
    if (data) {
      const tallasIds = data.map(c => c.talla_id);
      const tallasFiltradas = tallas
        .filter(t => t.activo && tallasIds.includes(t.id))
        .sort((a, b) => {
          const aEsNumero = !isNaN(Number(a.nombre));
          const bEsNumero = !isNaN(Number(b.nombre));
          if (aEsNumero && !bEsNumero) return -1;
          if (!aEsNumero && bEsNumero) return 1;
          if (aEsNumero && bEsNumero) return Number(a.nombre) - Number(b.nombre);
          return a.nombre.localeCompare(b.nombre);
        });
      setTallasDisponibles(tallasFiltradas);
    }
  };

  // NUEVA: Detectar clics fuera del contenedor para ocultar dropdown
  useEffect(() => {
    const handleClickFuera = (event: MouseEvent) => {
      if (contenedorPrendaRef.current && !contenedorPrendaRef.current.contains(event.target as Node)) {
        setMostrarListaPrendas(false);
      }
    };

    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  // ELIMINADO: useEffect y seleccionarPrenda viejos - ahora se usa seleccionarPrendaDelDropdown

  const seleccionarTalla = (tallaId: string) => {
    const talla = tallasDisponibles.find(t => t.id === tallaId);
    const costo = costos.find(c => 
      c.prenda_id === detalleActual.prenda_id && 
      c.talla_id === tallaId
    );
    
    if (costo) {
      setDetalleActual({
        ...detalleActual,
        talla_id: tallaId,
        talla_nombre: talla?.nombre || '',
        precio: costo.precio_venta.toString(),
      });
    }
  };

  const agregarDetalle = () => {
    if (!detalleActual.prenda_id || !detalleActual.talla_id || !detalleActual.cantidad || parseFloat(detalleActual.cantidad) <= 0) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    const costo = costos.find(c => 
      c.prenda_id === detalleActual.prenda_id && 
      c.talla_id === detalleActual.talla_id
    );

    if (!costo) {
      alert('No se encontró el costo para esta prenda y talla');
      return;
    }

    if (costo.stock < parseFloat(detalleActual.cantidad)) {
      alert('Stock insuficiente');
      return;
    }

    const cantidad = parseFloat(detalleActual.cantidad);
    const precio = parseFloat(detalleActual.precio);
    const total = cantidad * precio;

    const nuevoDetalle: DetallePedido = {
      prenda: detalleActual.prenda_nombre,
      prenda_id: detalleActual.prenda_id,
      talla: detalleActual.talla_nombre,
      talla_id: detalleActual.talla_id,
      especificaciones: detalleActual.especificaciones,
      cantidad: cantidad,
      pendiente: cantidad, // Inicialmente pendiente = cantidad
      precio: precio,
      total: total,
      costoId: costo.id,
    };

    setFormData({ 
      ...formData, 
      detalles: [...formData.detalles, nuevoDetalle] 
    });
    
    setDetalleActual({ 
      prenda_id: '', 
      prenda_nombre: '',
      talla_id: '', 
      talla_nombre: '',
      especificaciones: '',
      cantidad: '0', 
      precio: '0' 
    });
    setTextoPrendaBusqueda('');
    setTallasDisponibles([]);
  };

  const eliminarDetalle = (index: number) => {
    setFormData({
      ...formData,
      detalles: formData.detalles.filter((_, i) => i !== index)
    });
  };

  const calcularTotal = () => {
    return formData.detalles.reduce((total, detalle) => 
      total + detalle.total, 0
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.cliente_tipo) {
      alert('Por favor selecciona un cliente');
      return;
    }
    const nuevoPedido: Pedido = {
      id: Date.now(),
      fecha: new Date().toISOString().split('T')[0],
      cliente: formData.cliente_nombre,
      tipoCliente: formData.cliente_tipo,
      total: calcularTotal(),
      estado: 'PEDIDO',
    };
    setPedidos([nuevoPedido, ...pedidos]);
    setFormData({ 
      cliente_id: '', 
      cliente_tipo: '', 
      cliente_nombre: '', 
      detalles: [],
      observaciones: '',
      modalidad_pago: 'TOTAL',
      efectivo_recibido: 0
    });
    setBusquedaCliente('');
    setClienteSeleccionado(null);
    setMostrarFormulario(false);
  };

  const cambiarEstado = (id: number, nuevoEstado: Pedido['estado']) => {
    setPedidos(pedidos.map(p => 
      p.id === id ? { ...p, estado: nuevoEstado } : p
    ));
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            🛒 Gestión de Pedidos
          </h1>
          <button className="btn btn-primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
            ➕ Nuevo Pedido
          </button>
        </div>

        {mostrarFormulario && (
          <div className="form-container" style={{ maxWidth: '1600px', width: '95%' }}>
            <h2 className="form-title">Nuevo Pedido</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={inputClienteRef}
                    type="text"
                    className="form-input"
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value);
                      if (e.target.value === '') {
                        setFormData({ ...formData, cliente_id: '', cliente_tipo: '', cliente_nombre: '' });
                        setClienteSeleccionado(null);
                      }
                    }}
                    onFocus={() => {
                      if (resultadosBusqueda.length > 0) {
                        setMostrarResultados(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setMostrarResultados(false), 200);
                    }}
                    placeholder="🔍 Buscar cliente (alumno o externo)..."
                    required
                    style={{ width: '100%' }}
                  />

                  {/* Dropdown de resultados */}
                  {mostrarResultados && resultadosBusqueda.length > 0 && (
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
                      {resultadosBusqueda.map((cliente, index) => (
                        <div
                          key={`${cliente.tipo}-${cliente.id}`}
                          onClick={() => seleccionarCliente(cliente)}
                          style={{
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            borderBottom: index < resultadosBusqueda.length - 1 ? '1px solid #f0f0f0' : 'none',
                            transition: 'background-color 0.2s',
                            backgroundColor: formData.cliente_id === cliente.id ? '#e7f3ff' : 'white'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.cliente_id !== cliente.id) {
                              e.currentTarget.style.backgroundColor = '#f8f9fa';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.cliente_id !== cliente.id) {
                              e.currentTarget.style.backgroundColor = 'white';
                            } else {
                              e.currentTarget.style.backgroundColor = '#e7f3ff';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{cliente.tipo === 'alumno' ? '🎓' : '👤'}</span>
                            <span style={{ fontWeight: '600' }}>{cliente.nombre}</span>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#666',
                              marginLeft: 'auto',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: cliente.tipo === 'alumno' ? '#dbeafe' : '#fef3c7',
                              borderRadius: '4px'
                            }}>
                              {cliente.tipo === 'alumno' ? 'Alumno' : 'Externo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mostrar datos del cliente seleccionado */}
                {clienteSeleccionado && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '600' }}>
                      {formData.cliente_tipo === 'alumno' ? '🎓 Datos del Alumno' : '👤 Datos del Cliente'}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div>
                        <strong>Nombre:</strong> {clienteSeleccionado.nombre}
                      </div>
                      {formData.cliente_tipo === 'alumno' && (
                        <>
                          {clienteSeleccionado.referencia && (
                            <div>
                              <strong>Referencia:</strong> {clienteSeleccionado.referencia}
                            </div>
                          )}
                          {clienteSeleccionado.grado && (
                            <div>
                              <strong>Grado:</strong> {clienteSeleccionado.grado}
                            </div>
                          )}
                          {clienteSeleccionado.grupo && (
                            <div>
                              <strong>Grupo:</strong> {clienteSeleccionado.grupo}
                            </div>
                          )}
                        </>
                      )}
                      {formData.cliente_tipo === 'externo' && (
                        <>
                          {clienteSeleccionado.telefono && (
                            <div>
                              <strong>Teléfono:</strong> {clienteSeleccionado.telefono}
                            </div>
                          )}
                          {clienteSeleccionado.email && (
                            <div>
                              <strong>Email:</strong> {clienteSeleccionado.email}
                            </div>
                          )}
                          {clienteSeleccionado.direccion && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <strong>Dirección:</strong> {clienteSeleccionado.direccion}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', marginBottom: '1rem', border: '1px solid #e0e0e0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontWeight: '600', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📄 Detalles del Pedido
                  </h3>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={agregarDetalle}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                  >
                    + Agregar Prenda
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>👕 Prenda</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>📏 Talla</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', fontSize: '0.9rem' }}>ℹ️ Especificaciones</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', fontSize: '0.9rem' }}>🔢 Cantidad</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', fontSize: '0.9rem' }}>⏰ Pendiente</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', fontSize: '0.9rem' }}>$ Precio Unit.</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', fontSize: '0.9rem' }}>Total</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', fontSize: '0.9rem' }}>🗑️ Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Fila para agregar nuevo detalle */}
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div ref={contenedorPrendaRef} style={{ position: 'relative' }}>
                            <input
                              ref={inputPrendaRef}
                              type="text"
                              className="form-input"
                              value={textoPrendaBusqueda}
                              onChange={handleCambioBusquedaPrenda}
                              onFocus={() => {
                                if (textoPrendaBusqueda.trim().length >= 2 && prendasEncontradas.length > 0) {
                                  setMostrarListaPrendas(true);
                                }
                              }}
                              placeholder="SELECCIONAR PRENDA..."
                              style={{ width: '100%', fontSize: '0.9rem' }}
                            />
                            
                            {mostrarListaPrendas && prendasEncontradas.length > 0 && (() => {
                              const rect = inputPrendaRef.current?.getBoundingClientRect();
                              return (
                                <div style={{
                                  position: 'fixed',
                                  top: rect ? `${rect.bottom + 4}px` : 'auto',
                                  left: rect ? `${rect.left}px` : 'auto',
                                  width: rect ? `${rect.width}px` : 'auto',
                                  backgroundColor: 'white',
                                  border: '2px solid #3b82f6',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  zIndex: 9999,
                                  maxHeight: '300px',
                                  overflowY: 'auto'
                                }}>
                                {prendasEncontradas.map((prenda, idx) => (
                                  <div
                                    key={prenda.id}
                                    onClick={() => seleccionarPrendaDelDropdown(prenda)}
                                    style={{
                                      padding: '0.75rem 1rem',
                                      cursor: 'pointer',
                                      borderBottom: idx < prendasEncontradas.length - 1 ? '1px solid #e5e7eb' : 'none',
                                      backgroundColor: detalleActual.prenda_id === prenda.id ? '#dbeafe' : 'white'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 
                                        detalleActual.prenda_id === prenda.id ? '#dbeafe' : 'white';
                                    }}
                                  >
                                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                                      {prenda.nombre}
                                    </div>
                                    {prenda.codigo && (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                                        Código: {prenda.codigo}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <select
                            className="form-select"
                            value={detalleActual.talla_id}
                            onChange={(e) => seleccionarTalla(e.target.value)}
                            disabled={!detalleActual.prenda_id}
                            style={{ width: '100%', fontSize: '0.9rem' }}
                          >
                            <option value="">Seleccionar</option>
                            {tallasDisponibles.map(talla => (
                              <option key={talla.id} value={talla.id}>
                                {talla.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={detalleActual.especificaciones}
                            onChange={(e) => setDetalleActual({ ...detalleActual, especificaciones: e.target.value })}
                            placeholder="Color, bordado, notas..."
                            style={{ width: '100%', fontSize: '0.9rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            className="form-input"
                            value={detalleActual.cantidad}
                            onChange={(e) => {
                              const cantidad = e.target.value;
                              setDetalleActual({ ...detalleActual, cantidad });
                            }}
                            min="0"
                            style={{ width: '80px', textAlign: 'center', fontSize: '0.9rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: parseFloat(detalleActual.cantidad) > 0 ? '#f59e0b' : '#e0e0e0'
                          }}></span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={detalleActual.precio}
                            onChange={(e) => setDetalleActual({ ...detalleActual, precio: e.target.value })}
                            readOnly
                            style={{ width: '100px', textAlign: 'right', fontSize: '0.9rem', backgroundColor: '#f8f9fa' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                          ${(parseFloat(detalleActual.cantidad) * parseFloat(detalleActual.precio)).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setDetalleActual({ 
                                prenda_id: '', 
                                prenda_nombre: '',
                                talla_id: '', 
                                talla_nombre: '',
                                especificaciones: '',
                                cantidad: '0', 
                                precio: '0' 
                              });
                              setTextoPrendaBusqueda('');
                              setTallasDisponibles([]);
                            }}
                            className="btn btn-danger"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>

                      {/* Filas de detalles agregados */}
                      {formData.detalles.map((detalle, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
                          <td style={{ padding: '0.75rem', fontWeight: '600' }}>{detalle.prenda}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className="badge badge-info">{detalle.talla}</span>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                            {detalle.especificaciones || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600' }}>
                            {detalle.cantidad}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: detalle.pendiente > 0 ? '#f59e0b' : '#10b981'
                            }}></span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            ${detalle.precio.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                            ${detalle.total.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => eliminarDetalle(index)}
                              className="btn btn-danger"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sección de Observaciones y Resumen */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1rem', 
                marginTop: '1rem' 
              }}>
                {/* Observaciones del Pedido */}
                <div style={{ 
                  border: '1px solid #e0e0e0', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  backgroundColor: '#fafafa'
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    💬 Observaciones del Pedido
                  </h3>
                  <textarea
                    className="form-input"
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Agregar observaciones o notas especiales..."
                    rows={5}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                {/* Resumen del Pedido */}
                <div style={{ 
                  border: '1px solid #e0e0e0', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  backgroundColor: '#2c3e50',
                  color: 'white'
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📊 Resumen del Pedido
                  </h3>
                  
                  {/* Subtotal */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '1rem',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    padding: '0.5rem',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '4px'
                  }}>
                    <span>💵 Subtotal:</span>
                    <span style={{ color: '#10b981' }}>
                      ${(() => {
                        const totalDetalles = formData.detalles.reduce((sum, det) => sum + det.total, 0);
                        const totalActual = (parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0);
                        return (totalDetalles + totalActual).toFixed(2);
                      })()}
                    </span>
                  </div>

                  {/* Modalidad de Pago */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                      💳 Modalidad de Pago:
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="modalidad_pago"
                          value="TOTAL"
                          checked={formData.modalidad_pago === 'TOTAL'}
                          onChange={(e) => setFormData({ ...formData, modalidad_pago: 'TOTAL' })}
                          style={{ cursor: 'pointer' }}
                        />
                        Pago Total
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="modalidad_pago"
                          value="ANTICIPO"
                          checked={formData.modalidad_pago === 'ANTICIPO'}
                          onChange={(e) => setFormData({ ...formData, modalidad_pago: 'ANTICIPO' })}
                          style={{ cursor: 'pointer' }}
                        />
                        Anticipo
                      </label>
                    </div>
                  </div>

                  {/* Efectivo Recibido */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                      💰 Efectivo Recibido:
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.efectivo_recibido}
                      onChange={(e) => setFormData({ ...formData, efectivo_recibido: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      style={{ 
                        width: '100%', 
                        padding: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'white',
                        color: '#2c3e50'
                      }}
                    />
                  </div>

                  {/* Cambio a Entregar */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    fontSize: '1.1rem',
                    fontWeight: '600'
                  }}>
                    <span>🔄 Cambio a Entregar:</span>
                    <span style={{ 
                      color: (() => {
                        const totalDetalles = formData.detalles.reduce((sum, det) => sum + det.total, 0);
                        const totalActual = (parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0);
                        const totalGeneral = totalDetalles + totalActual;
                        return formData.efectivo_recibido < totalGeneral ? '#ef4444' : '#10b981';
                      })()
                    }}>
                      ${(() => {
                        const totalDetalles = formData.detalles.reduce((sum, det) => sum + det.total, 0);
                        const totalActual = (parseFloat(detalleActual.cantidad) || 0) * (parseFloat(detalleActual.precio) || 0);
                        const totalGeneral = totalDetalles + totalActual;
                        return Math.max(0, formData.efectivo_recibido - totalGeneral).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={formData.detalles.length === 0}>
                  💾 Crear Pedido
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setFormData({ 
                      cliente_id: '', 
                      cliente_tipo: '', 
                      cliente_nombre: '', 
                      detalles: [],
                      observaciones: '',
                      modalidad_pago: 'TOTAL',
                      efectivo_recibido: 0
                    });
                    setBusquedaCliente('');
                    setClienteSeleccionado(null);
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
                <th>ID</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.id}>
                  <td style={{ fontFamily: 'monospace' }}>#{pedido.id}</td>
                  <td>{pedido.fecha}</td>
                  <td style={{ fontWeight: '600' }}>{pedido.cliente}</td>
                  <td>
                    <span className={`badge ${pedido.tipoCliente === 'alumno' ? 'badge-info' : 'badge-warning'}`}>
                      {pedido.tipoCliente === 'alumno' ? '🎓 Alumno' : '👤 Externo'}
                    </span>
                  </td>
                  <td style={{ fontWeight: '700', color: '#10b981' }}>${pedido.total.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${
                      pedido.estado === 'PEDIDO' ? 'badge-warning' :
                      pedido.estado === 'ENTREGADO' ? 'badge-info' :
                      pedido.estado === 'LIQUIDADO' ? 'badge-success' : 'badge-danger'
                    }`}>
                      {pedido.estado}
                    </span>
                  </td>
                  <td>
                    {pedido.estado === 'PEDIDO' && (
                      <button
                        className="btn btn-success"
                        style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
                        onClick={() => cambiarEstado(pedido.id, 'ENTREGADO')}
                      >
                        ✓ Entregar
                      </button>
                    )}
                    {pedido.estado === 'ENTREGADO' && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
                        onClick={() => cambiarEstado(pedido.id, 'LIQUIDADO')}
                      >
                        💵 Liquidar
                      </button>
                    )}
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                      👁️ Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutWrapper>
  );
}


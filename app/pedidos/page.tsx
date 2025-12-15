'use client';

import { useState, useRef, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';
import { useAlumnos } from '@/lib/hooks/useAlumnos';
import { useExternos } from '@/lib/hooks/useExternos';

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
  talla: string;
  cantidad: number;
  precio: number;
  costoId?: string;
}

export const dynamic = 'force-dynamic';

export default function PedidosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { costos } = useCostos();
  const { alumnos, searchAlumnos } = useAlumnos();
  const { externos } = useExternos();
  
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
    prenda: '',
    talla: '',
    cantidad: '1',
    precio: '',
  });

  // Función para buscar clientes (alumnos y externos)
  useEffect(() => {
    const buscarClientes = async () => {
      if (busquedaCliente.trim().length < 2) {
        setResultadosBusqueda([]);
        setMostrarResultados(false);
        return;
      }

      const query = busquedaCliente.trim().toLowerCase();
      const resultados: Array<{
        id: string;
        nombre: string;
        tipo: 'alumno' | 'externo';
        datos: any;
      }> = [];

      // Buscar en alumnos
      const alumnosEncontrados = await searchAlumnos(query);
      alumnosEncontrados.slice(0, 10).forEach(alumno => {
        resultados.push({
          id: alumno.id,
          nombre: alumno.nombre,
          tipo: 'alumno',
          datos: alumno,
        });
      });

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

      setResultadosBusqueda(resultados.slice(0, 10));
      setMostrarResultados(resultados.length > 0);
    };

    buscarClientes();
  }, [busquedaCliente, searchAlumnos, externos]);

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

  const agregarDetalle = () => {
    if (detalleActual.prenda && detalleActual.cantidad && detalleActual.precio) {
      const costo = costos.find(c => c.id === detalleActual.prenda);
      if (!costo || costo.stock < parseInt(detalleActual.cantidad)) {
        alert('Stock insuficiente');
        return;
      }
      const nuevoDetalle: DetallePedido = {
        prenda: (costo as any).prenda?.nombre || '',
        talla: (costo as any).talla?.nombre || '',
        cantidad: parseInt(detalleActual.cantidad),
        precio: parseFloat(detalleActual.precio),
      };
      setFormData({ 
        ...formData, 
        detalles: [...formData.detalles, { ...nuevoDetalle, costoId: detalleActual.prenda }] 
      });
      setDetalleActual({ prenda: '', talla: '', cantidad: '1', precio: '' });
    }
  };

  const eliminarDetalle = (index: number) => {
    setFormData({
      ...formData,
      detalles: formData.detalles.filter((_, i) => i !== index)
    });
  };

  const calcularTotal = () => {
    return formData.detalles.reduce((total, detalle) => 
      total + (detalle.cantidad * detalle.precio), 0
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
    setFormData({ cliente_id: '', cliente_tipo: '', cliente_nombre: '', detalles: [] });
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
          <div className="form-container">
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

              <div style={{ background: '#f3f4f6', padding: '1.5rem', borderRadius: '10px', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Agregar Productos</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Prenda + Talla</label>
                    <select
                      className="form-select"
                      value={detalleActual.prenda}
                      onChange={(e) => {
                        const costoId = e.target.value;
                        const costo = costos.find(c => c.id === costoId);
                        if (costo) {
                          setDetalleActual({ 
                            prenda: costoId, 
                            talla: '', 
                            cantidad: '1', 
                            precio: costo.precio_venta.toString() 
                          });
                        }
                      }}
                    >
                      <option value="">Seleccionar</option>
                      {costos.filter(c => c.activo && c.stock > 0).map(costo => (
                        <option key={costo.id} value={costo.id}>
                          {(costo as any).prenda?.nombre || '-'} - {(costo as any).talla?.nombre || '-'} (${costo.precio_venta.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Cant.</label>
                    <input
                      type="number"
                      className="form-input"
                      value={detalleActual.cantidad}
                      onChange={(e) => setDetalleActual({ ...detalleActual, cantidad: e.target.value })}
                      min="1"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Precio</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={detalleActual.precio}
                      onChange={(e) => setDetalleActual({ ...detalleActual, precio: e.target.value })}
                      placeholder="$0.00"
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={agregarDetalle}
                    style={{ padding: '0.8rem 1rem' }}
                  >
                    ➕ Agregar
                  </button>
                </div>

                {formData.detalles.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <table className="table" style={{ marginTop: 0 }}>
                      <thead>
                        <tr>
                          <th>Prenda</th>
                          <th>Talla</th>
                          <th>Cantidad</th>
                          <th>Precio</th>
                          <th>Subtotal</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.detalles.map((detalle, index) => (
                          <tr key={index}>
                            <td>{detalle.prenda}</td>
                            <td>{detalle.talla}</td>
                            <td>{detalle.cantidad}</td>
                            <td>${detalle.precio.toFixed(2)}</td>
                            <td>${(detalle.cantidad * detalle.precio).toFixed(2)}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => eliminarDetalle(index)}
                                className="btn btn-danger"
                                style={{ padding: '0.3rem 0.6rem' }}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'right', fontWeight: '700' }}>TOTAL:</td>
                          <td colSpan={2} style={{ fontWeight: '700', fontSize: '1.2rem', color: '#10b981' }}>
                            ${calcularTotal().toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="btn-group">
                <button type="submit" className="btn btn-primary" disabled={formData.detalles.length === 0}>
                  💾 Crear Pedido
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setFormData({ cliente_id: '', cliente_tipo: '', cliente_nombre: '', detalles: [] });
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


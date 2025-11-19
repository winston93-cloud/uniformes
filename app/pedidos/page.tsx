'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useCostos } from '@/lib/hooks/useCostos';

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
  
  const [pedidos, setPedidos] = useState<Pedido[]>([
    { id: 1, fecha: '2024-11-19', cliente: 'Juan Pérez', tipoCliente: 'alumno', total: 750, estado: 'PEDIDO' },
    { id: 2, fecha: '2024-11-18', cliente: 'María García', tipoCliente: 'alumno', total: 1200, estado: 'ENTREGADO' },
    { id: 3, fecha: '2024-11-17', cliente: 'Pedro López', tipoCliente: 'externo', total: 950, estado: 'LIQUIDADO' },
  ]);

  const [formData, setFormData] = useState({
    tipoCliente: 'alumno' as 'alumno' | 'externo',
    cliente: '',
    detalles: [] as DetallePedido[],
  });

  const [detalleActual, setDetalleActual] = useState({
    prenda: '',
    talla: '',
    cantidad: '1',
    precio: '',
  });

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
    const nuevoPedido: Pedido = {
      id: Date.now(),
      fecha: new Date().toISOString().split('T')[0],
      cliente: formData.cliente,
      tipoCliente: formData.tipoCliente,
      total: calcularTotal(),
      estado: 'PEDIDO',
    };
    setPedidos([nuevoPedido, ...pedidos]);
    setFormData({ tipoCliente: 'alumno', cliente: '', detalles: [] });
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipo de Cliente *</label>
                  <select
                    className="form-select"
                    value={formData.tipoCliente}
                    onChange={(e) => setFormData({ ...formData, tipoCliente: e.target.value as 'alumno' | 'externo' })}
                    required
                  >
                    <option value="alumno">Alumno</option>
                    <option value="externo">Cliente Externo</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cliente *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                    placeholder="Nombre del cliente"
                    required
                  />
                </div>
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
                    setFormData({ tipoCliente: 'alumno', cliente: '', detalles: [] });
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


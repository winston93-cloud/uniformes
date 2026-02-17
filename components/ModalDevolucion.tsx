'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDevoluciones, type CrearDevolucionData } from '@/lib/hooks/useDevoluciones';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useTallas } from '@/lib/hooks/useTallas';

interface ModalDevolucionProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: any; // El pedido completo con sus detalles
  onSuccess?: () => void;
}

interface DetalleDevolucionForm {
  detalle_pedido_id: string;
  prenda_id: string;
  prenda_nombre: string;
  prenda_codigo?: string;
  talla_id: string;
  talla_nombre: string;
  cantidad_original: number;
  cantidad_devuelta: number;
  precio_unitario: number;
  seleccionado: boolean;
  especificaciones?: string;
  
  // Para cambios
  es_cambio: boolean;
  prenda_cambio_id?: string;
  talla_cambio_id?: string;
  cantidad_cambio?: number;
  precio_cambio?: number;
  observaciones_detalle?: string;
}

export default function ModalDevolucion({ isOpen, onClose, pedido, onSuccess }: ModalDevolucionProps) {
  const { sesion } = useAuth();
  const { crearDevolucion } = useDevoluciones(sesion?.sucursal_id);
  const { prendas } = usePrendas();
  const { tallas } = useTallas();

  const [tipoDevolucion, setTipoDevolucion] = useState<'COMPLETA' | 'PARCIAL' | 'CAMBIO_TALLA' | 'CAMBIO_PRENDA'>('COMPLETA');
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [reembolsoAplicado, setReembolsoAplicado] = useState(false);
  const [montoReembolsado, setMontoReembolsado] = useState(0);
  const [detalles, setDetalles] = useState<DetalleDevolucionForm[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Inicializar detalles cuando se abre el modal
  useEffect(() => {
    if (isOpen && pedido && pedido.detalles) {
      const detallesIniciales: DetalleDevolucionForm[] = pedido.detalles.map((det: any) => ({
        detalle_pedido_id: det.id,
        prenda_id: det.prenda_id,
        prenda_nombre: det.prenda,
        talla_id: det.talla_id,
        talla_nombre: det.talla,
        cantidad_original: det.cantidad,
        cantidad_devuelta: det.cantidad, // Por defecto, devolver todo
        precio_unitario: det.precio,
        seleccionado: tipoDevolucion === 'COMPLETA', // Si es completa, seleccionar todo
        es_cambio: false,
      }));
      setDetalles(detallesIniciales);
    }
  }, [isOpen, pedido, tipoDevolucion]);

  // Actualizar selección cuando cambia el tipo
  useEffect(() => {
    if (tipoDevolucion === 'COMPLETA') {
      setDetalles(prev => prev.map(d => ({ ...d, seleccionado: true, cantidad_devuelta: d.cantidad_original })));
    } else {
      setDetalles(prev => prev.map(d => ({ ...d, seleccionado: false, cantidad_devuelta: 0 })));
    }
  }, [tipoDevolucion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sesion) {
      alert('No hay sesión activa');
      return;
    }

    const detallesSeleccionados = detalles.filter(d => d.seleccionado && d.cantidad_devuelta > 0);

    if (detallesSeleccionados.length === 0) {
      alert('Debes seleccionar al menos un artículo para devolver');
      return;
    }

    if (!motivo.trim()) {
      alert('Debes indicar el motivo de la devolución');
      return;
    }

    setGuardando(true);

    const dataDevolucion: CrearDevolucionData = {
      pedido_id: pedido.id,
      sucursal_id: sesion.sucursal_id,
      usuario_id: sesion.usuario_id,
      tipo_devolucion: tipoDevolucion,
      motivo,
      observaciones,
      reembolso_aplicado: reembolsoAplicado,
      monto_reembolsado: reembolsoAplicado ? montoReembolsado : 0,
      detalles: detallesSeleccionados.map(det => ({
        detalle_pedido_id: det.detalle_pedido_id,
        prenda_id: det.prenda_id,
        talla_id: det.talla_id,
        cantidad_devuelta: det.cantidad_devuelta,
        precio_unitario: det.precio_unitario,
        subtotal: det.cantidad_devuelta * det.precio_unitario,
        es_cambio: det.es_cambio,
        prenda_cambio_id: det.prenda_cambio_id,
        talla_cambio_id: det.talla_cambio_id,
        cantidad_cambio: det.cantidad_cambio,
        precio_cambio: det.precio_cambio,
        observaciones_detalle: det.observaciones_detalle,
      })),
    };

    const result = await crearDevolucion(dataDevolucion);

    setGuardando(false);

    if (result.success) {
      alert('✅ Devolución registrada correctamente');
      onSuccess?.();
      onClose();
    } else {
      alert(`❌ Error al registrar devolución: ${result.error}`);
    }
  };

  const toggleSeleccion = (index: number) => {
    setDetalles(prev => prev.map((d, i) => 
      i === index ? { ...d, seleccionado: !d.seleccionado } : d
    ));
  };

  const actualizarCantidad = (index: number, cantidad: number) => {
    setDetalles(prev => prev.map((d, i) => 
      i === index ? { ...d, cantidad_devuelta: Math.min(cantidad, d.cantidad_original) } : d
    ));
  };

  const toggleCambio = (index: number) => {
    setDetalles(prev => prev.map((d, i) => 
      i === index ? { ...d, es_cambio: !d.es_cambio } : d
    ));
  };

  const totalDevolucion = detalles
    .filter(d => d.seleccionado)
    .reduce((sum, d) => sum + (d.cantidad_devuelta * d.precio_unitario), 0);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>🔄 Registrar Devolución</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Info del pedido */}
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>📦 Pedido: {pedido?.cliente || pedido?.cliente_nombre}</h3>
              <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
                Total: ${(pedido?.total || 0).toFixed(2)} | Fecha: {new Date(pedido?.created_at || pedido?.fecha).toLocaleDateString('es-MX')}
              </p>
            </div>

            {/* Tipo de devolución */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Tipo de Devolución *
              </label>
              <select
                value={tipoDevolucion}
                onChange={(e) => setTipoDevolucion(e.target.value as any)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                required
              >
                <option value="COMPLETA">🔄 Devolución Completa</option>
                <option value="PARCIAL">📦 Devolución Parcial</option>
                <option value="CAMBIO_TALLA">📏 Cambio de Talla</option>
                <option value="CAMBIO_PRENDA">👕 Cambio de Prenda</option>
              </select>
            </div>

            {/* Motivo */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Motivo *
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                required
              >
                <option value="">Selecciona un motivo...</option>
                <option value="Talla incorrecta">📏 Talla incorrecta</option>
                <option value="Defecto de fabricación">🔧 Defecto de fabricación</option>
                <option value="No le gustó">❌ No le gustó</option>
                <option value="Color diferente">🎨 Color diferente</option>
                <option value="Entrega tardía">⏰ Entrega tardía</option>
                <option value="Cambio de opinión">💭 Cambio de opinión</option>
                <option value="Otro">📝 Otro</option>
              </select>
            </div>

            {/* Observaciones */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Detalles adicionales sobre la devolución..."
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px' }}
              />
            </div>

            {/* Artículos */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Artículos a devolver:</h3>
              <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                {detalles.map((det, index) => (
                  <div key={index} style={{ 
                    padding: '1rem', 
                    borderBottom: index < detalles.length - 1 ? '1px solid #eee' : 'none',
                    background: det.seleccionado ? '#f0f8ff' : 'white'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={det.seleccionado}
                        onChange={() => toggleSeleccion(index)}
                        disabled={tipoDevolucion === 'COMPLETA'}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <strong style={{ fontSize: '1rem' }}>{det.prenda_nombre}</strong>
                          {det.prenda_codigo && (
                            <span style={{ fontSize: '0.85rem', color: '#666', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
                              {det.prenda_codigo}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 'bold' }}>Talla:</span> {det.talla_nombre}
                          {det.especificaciones && (
                            <>
                              {' '} | <span style={{ fontWeight: 'bold' }}>Especificaciones:</span> {det.especificaciones}
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          💰 Precio unitario: ${(det.precio_unitario || 0).toFixed(2)} | 
                          📦 Cantidad: {det.cantidad_original} | 
                          💵 Subtotal: ${((det.precio_unitario || 0) * (det.cantidad_original || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {det.seleccionado && (
                      <div style={{ marginLeft: '2rem', display: 'grid', gap: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Cantidad a devolver:</label>
                          <input
                            type="number"
                            min="1"
                            max={det.cantidad_original}
                            value={det.cantidad_devuelta}
                            onChange={(e) => actualizarCantidad(index, parseInt(e.target.value) || 0)}
                            style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', marginLeft: '0.5rem' }}
                          />
                        </div>

                        {(tipoDevolucion === 'CAMBIO_TALLA' || tipoDevolucion === 'CAMBIO_PRENDA') && (
                          <div style={{ background: '#fff9e6', padding: '0.75rem', borderRadius: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <input
                                type="checkbox"
                                checked={det.es_cambio}
                                onChange={() => toggleCambio(index)}
                              />
                              <span style={{ fontWeight: 'bold' }}>🔄 Es un cambio</span>
                            </label>

                            {det.es_cambio && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div>
                                  <label style={{ fontSize: '0.85rem' }}>Nueva prenda:</label>
                                  <select
                                    value={det.prenda_cambio_id || ''}
                                    onChange={(e) => setDetalles(prev => prev.map((d, i) => 
                                      i === index ? { ...d, prenda_cambio_id: e.target.value } : d
                                    ))}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                                  >
                                    <option value="">Seleccionar...</option>
                                    {prendas.map(p => (
                                      <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.85rem' }}>Nueva talla:</label>
                                  <select
                                    value={det.talla_cambio_id || ''}
                                    onChange={(e) => setDetalles(prev => prev.map((d, i) => 
                                      i === index ? { ...d, talla_cambio_id: e.target.value } : d
                                    ))}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                                  >
                                    <option value="">Seleccionar...</option>
                                    {tallas.map(t => (
                                      <option key={t.id} value={t.id}>{t.nombre}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.85rem' }}>Cantidad:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={det.cantidad_cambio || det.cantidad_devuelta}
                                    onChange={(e) => setDetalles(prev => prev.map((d, i) => 
                                      i === index ? { ...d, cantidad_cambio: parseInt(e.target.value) || 0 } : d
                                    ))}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reembolso */}
            <div style={{ background: '#fff3cd', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={reembolsoAplicado}
                  onChange={(e) => setReembolsoAplicado(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 'bold' }}>💰 Aplicar reembolso económico</span>
              </label>

              {reembolsoAplicado && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem' }}>Monto a reembolsar:</label>
                  <input
                    type="number"
                    min="0"
                    max={totalDevolucion}
                    step="0.01"
                    value={montoReembolsado}
                    onChange={(e) => setMontoReembolsado(parseFloat(e.target.value) || 0)}
                    style={{ width: '150px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', marginLeft: '0.5rem' }}
                  />
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                    (Máximo: ${(totalDevolucion || 0).toFixed(2)})
                  </span>
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{ background: '#e7f3ff', padding: '1rem', borderRadius: '8px', textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                Total devolución: ${(totalDevolucion || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardando || detalles.filter(d => d.seleccionado).length === 0}>
              {guardando ? '⏳ Guardando...' : '✅ Registrar Devolución'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

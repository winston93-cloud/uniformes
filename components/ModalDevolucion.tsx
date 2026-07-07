'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDevoluciones, type CrearDevolucionData } from '@/lib/hooks/useDevoluciones';
import { usePrendas } from '@/lib/hooks/usePrendas';
import { useCostos } from '@/lib/hooks/useCostos';
import { useTallas } from '@/lib/hooks/useTallas';
import { opcionesInventarioDesdeSesion } from '@/lib/inventarioSucursal';

interface ModalDevolucionProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: any;
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
  pendiente?: number;
  precio_unitario: number;
  seleccionado: boolean;
  especificaciones?: string;
  es_cambio: boolean;
  prenda_cambio_id?: string;
  talla_cambio_id?: string;
  cantidad_cambio?: number;
  precio_cambio?: number;
  observaciones_detalle?: string;
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10050,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.78) 0%, rgba(30, 58, 138, 0.55) 100%)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
};

const panel: CSSProperties = {
  width: '100%',
  maxWidth: 920,
  maxHeight: 'min(92vh, 900px)',
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  borderRadius: 20,
  overflow: 'hidden',
  boxShadow:
    '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.08) inset',
};

const headerGradient: CSSProperties = {
  padding: '1.25rem 1.5rem',
  background: 'linear-gradient(135deg, #0d9488 0%, #0e7490 40%, #1e3a8a 100%)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
};

const labelSm: CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#64748b',
  marginBottom: '0.35rem',
};

const inputBase: CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: '0.95rem',
  background: '#fff',
  outline: 'none',
};

export default function ModalDevolucion({ isOpen, onClose, pedido, onSuccess }: ModalDevolucionProps) {
  const { sesion } = useAuth();
  const { crearDevolucion } = useDevoluciones(sesion?.sucursal_id);
  const inventarioOpts = opcionesInventarioDesdeSesion(sesion, 'venta');
  const { prendas } = usePrendas(inventarioOpts);
  const { tallas } = useTallas();
  const { costos } = useCostos(
    sesion?.sucursal_id,
    sesion?.es_matriz,
    {
      catalogoCompleto: inventarioOpts.catalogoCompleto,
      incluirStockCero: inventarioOpts.incluirStockCero,
    }
  );

  const [tipoDevolucion, setTipoDevolucion] = useState<'COMPLETA' | 'PARCIAL' | 'CAMBIO_TALLA' | 'CAMBIO_PRENDA'>('COMPLETA');
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [reembolsoAplicado, setReembolsoAplicado] = useState(false);
  const [montoReembolsado, setMontoReembolsado] = useState(0);
  const [detalles, setDetalles] = useState<DetalleDevolucionForm[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen && pedido && pedido.detalles) {
      const detallesIniciales: DetalleDevolucionForm[] = pedido.detalles.map((det: any) => ({
        detalle_pedido_id: det.id,
        prenda_id: det.prenda_id,
        prenda_nombre: det.prenda_nombre || det.prenda || 'Prenda',
        talla_id: det.talla_id,
        talla_nombre: det.talla_nombre || det.talla || 'Talla',
        cantidad_original: det.cantidad,
        pendiente: det.pendiente ?? 0,
        cantidad_devuelta: 0,
        precio_unitario: det.precio_unitario ?? det.precio ?? 0,
        seleccionado: tipoDevolucion === 'COMPLETA',
        es_cambio: false,
      }));
      const detallesAjustados = detallesIniciales.map((d) => {
        const maxEntregado =
          pedido?.estado === 'PENDIENTE'
            ? Math.max(0, d.cantidad_original - (d.pendiente || 0))
            : d.cantidad_original;
        return {
          ...d,
          cantidad_devuelta: tipoDevolucion === 'COMPLETA' ? maxEntregado : 0,
          seleccionado: tipoDevolucion === 'COMPLETA' ? maxEntregado > 0 : false,
        };
      });
      setDetalles(detallesAjustados);
    }
  }, [isOpen, pedido, tipoDevolucion]);

  useEffect(() => {
    if (tipoDevolucion === 'COMPLETA') {
      setDetalles((prev) =>
        prev.map((d) => {
          const maxEntregado =
            pedido?.estado === 'PENDIENTE'
              ? Math.max(0, d.cantidad_original - (d.pendiente || 0))
              : d.cantidad_original;
          return { ...d, seleccionado: maxEntregado > 0, cantidad_devuelta: maxEntregado };
        })
      );
    } else {
      setDetalles((prev) => prev.map((d) => ({ ...d, seleccionado: false, cantidad_devuelta: 0 })));
    }
  }, [tipoDevolucion, pedido?.estado]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sesion) {
      alert('No hay sesión activa');
      return;
    }

    const detallesSeleccionados = detalles.filter((d) => d.seleccionado && d.cantidad_devuelta > 0);

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
      detalles: detallesSeleccionados.map((det) => ({
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
    setDetalles((prev) =>
      prev.map((d, i) => (i === index ? { ...d, seleccionado: !d.seleccionado } : d))
    );
  };

  const actualizarCantidad = (index: number, cantidad: number) => {
    setDetalles((prev) =>
      prev.map((d, i) =>
        i === index
          ? (() => {
              const maxEntregado =
                pedido?.estado === 'PENDIENTE'
                  ? Math.max(0, d.cantidad_original - (d.pendiente || 0))
                  : d.cantidad_original;
              return { ...d, cantidad_devuelta: Math.min(cantidad, maxEntregado) };
            })()
          : d
      )
    );
  };

  const bumpQty = (index: number, delta: number) => {
    const d = detalles[index];
    if (!d) return;
    const maxEntregado =
      pedido?.estado === 'PENDIENTE'
        ? Math.max(0, d.cantidad_original - (d.pendiente || 0))
        : d.cantidad_original;
    actualizarCantidad(index, d.cantidad_devuelta + delta);
  };

  const toggleCambio = (index: number) => {
    setDetalles((prev) =>
      prev.map((d, i) => (i === index ? { ...d, es_cambio: !d.es_cambio } : d))
    );
  };

  const resolverPrecioCambio = (prendaId?: string, tallaId?: string) => {
    if (!prendaId || !tallaId) return undefined;
    const costo = costos.find(
      (c) => c.prenda_id === prendaId && c.talla_id === tallaId && c.activo !== false
    );
    return costo?.precio_menudeo ?? costo?.precio_venta;
  };

  const actualizarCambio = (
    index: number,
    patch: Partial<Pick<DetalleDevolucionForm, 'prenda_cambio_id' | 'talla_cambio_id' | 'cantidad_cambio'>>
  ) => {
    setDetalles((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const next = { ...d, ...patch };
        const prendaId = patch.prenda_cambio_id ?? d.prenda_cambio_id;
        const tallaId = patch.talla_cambio_id ?? d.talla_cambio_id;
        const precio = resolverPrecioCambio(prendaId, tallaId);
        return precio != null ? { ...next, precio_cambio: precio } : next;
      })
    );
  };

  const totalDevolucion = detalles
    .filter((d) => d.seleccionado)
    .reduce((sum, d) => sum + d.cantidad_devuelta * d.precio_unitario, 0);

  if (!isOpen) return null;

  return createPortal(
    <div style={overlay} role="presentation">
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <header style={headerGradient}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                flexShrink: 0,
              }}
              aria-hidden
            >
              ↩️
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Devolución y cambios
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', opacity: 0.92 }}>
                Ajusta inventario: devolución al almacén y salida del artículo de cambio si aplica.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 12,
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              fontSize: '1.35rem',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <form style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} onSubmit={handleSubmit}>
          <div
            style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
              background: 'linear-gradient(180deg, #f0fdfa 0%, #fff 140px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
                padding: '1rem 1.15rem',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <span style={labelSm}>Cliente</span>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>
                  {pedido?.cliente || pedido?.cliente_nombre || '—'}
                </div>
              </div>
              <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                <span style={labelSm}>Total pedido</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  ${(pedido?.total || 0).toFixed(2)}
                </div>
              </div>
              <div style={{ flex: '1 1 100%', fontSize: '0.85rem', color: '#64748b' }}>
                Fecha:{' '}
                <strong style={{ color: '#334155' }}>
                  {new Date(pedido?.created_at || pedido?.fecha).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
                {pedido?.estado && (
                  <>
                    {' '}
                    · Estado:{' '}
                    <strong style={{ color: '#0f766e' }}>{pedido.estado}</strong>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelSm}>Tipo *</label>
                <select
                  value={tipoDevolucion}
                  onChange={(e) => setTipoDevolucion(e.target.value as typeof tipoDevolucion)}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  required
                >
                  <option value="COMPLETA">Devolución completa</option>
                  <option value="PARCIAL">Devolución parcial</option>
                  <option value="CAMBIO_TALLA">Cambio de talla</option>
                  <option value="CAMBIO_PRENDA">Cambio de prenda</option>
                </select>
              </div>
              <div>
                <label style={labelSm}>Motivo *</label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  required
                >
                  <option value="">Selecciona…</option>
                  <option value="Talla incorrecta">Talla incorrecta</option>
                  <option value="Defecto de fabricación">Defecto de fabricación</option>
                  <option value="No le gustó">No le gustó</option>
                  <option value="Color diferente">Color diferente</option>
                  <option value="Entrega tardía">Entrega tardía</option>
                  <option value="Cambio de opinión">Cambio de opinión</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelSm}>Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas internas para el equipo…"
                style={{ ...inputBase, minHeight: 88, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: '0.65rem' }}>
              <span style={{ ...labelSm, marginBottom: 0 }}>Artículos</span>
            </div>
            <div
              style={{
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                background: '#fff',
                marginBottom: '1rem',
              }}
            >
              {detalles.map((det, index) => {
                const maxEntregado =
                  pedido?.estado === 'PENDIENTE'
                    ? Math.max(0, det.cantidad_original - (det.pendiente || 0))
                    : det.cantidad_original;
                return (
                  <div
                    key={index}
                    style={{
                      padding: '1rem 1.15rem',
                      borderBottom: index < detalles.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: det.seleccionado
                        ? 'linear-gradient(90deg, #ecfeff 0%, #fff 45%)'
                        : '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={det.seleccionado}
                        onChange={() => toggleSeleccion(index)}
                        disabled={tipoDevolucion === 'COMPLETA'}
                        style={{
                          width: 20,
                          height: 20,
                          marginTop: 4,
                          accentColor: '#0d9488',
                          cursor: tipoDevolucion === 'COMPLETA' ? 'not-allowed' : 'pointer',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '1.02rem', color: '#0f172a' }}>{det.prenda_nombre}</strong>
                          {det.prenda_codigo && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: 6,
                                background: '#f1f5f9',
                                color: '#475569',
                              }}
                            >
                              {det.prenda_codigo}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '0.25rem' }}>
                          Talla <strong style={{ color: '#334155' }}>{det.talla_nombre}</strong>
                          {det.especificaciones && (
                            <span>
                              {' '}
                              · {det.especificaciones}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: 999,
                              background: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            ${(det.precio_unitario || 0).toFixed(2)} c/u
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: 999,
                              background: '#e0f2fe',
                              color: '#0369a1',
                            }}
                          >
                            Máx. a devolver {maxEntregado}
                          </span>
                        </div>
                      </div>
                    </div>

                    {det.seleccionado && (
                      <div style={{ marginLeft: 28, marginTop: '0.85rem', display: 'grid', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Cantidad</span>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              border: '1px solid #e2e8f0',
                              borderRadius: 12,
                              overflow: 'hidden',
                              background: '#f8fafc',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => bumpQty(index, -1)}
                              disabled={det.cantidad_devuelta <= 0}
                              style={{
                                width: 36,
                                height: 36,
                                border: 'none',
                                background: 'transparent',
                                cursor: det.cantidad_devuelta <= 0 ? 'not-allowed' : 'pointer',
                                color: '#64748b',
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={maxEntregado}
                              value={det.cantidad_devuelta}
                              onChange={(e) => actualizarCantidad(index, parseInt(e.target.value) || 0)}
                              style={{
                                width: 48,
                                border: 'none',
                                textAlign: 'center',
                                fontWeight: 800,
                                background: '#fff',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => bumpQty(index, 1)}
                              disabled={det.cantidad_devuelta >= maxEntregado}
                              style={{
                                width: 36,
                                height: 36,
                                border: 'none',
                                background: 'transparent',
                                cursor: det.cantidad_devuelta >= maxEntregado ? 'not-allowed' : 'pointer',
                                color: '#64748b',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {(tipoDevolucion === 'CAMBIO_TALLA' || tipoDevolucion === 'CAMBIO_PRENDA') && (
                          <div
                            style={{
                              padding: '0.85rem 1rem',
                              borderRadius: 14,
                              border: '1px solid #fde68a',
                              background: 'linear-gradient(135deg, #fffbeb 0%, #fff 100%)',
                            }}
                          >
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.5rem',
                                fontWeight: 800,
                                color: '#92400e',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={det.es_cambio}
                                onChange={() => toggleCambio(index)}
                                style={{ width: 18, height: 18, accentColor: '#d97706' }}
                              />
                              Registrar cambio (nueva prenda/talla)
                            </label>

                            {det.es_cambio && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                  gap: '0.65rem',
                                }}
                              >
                                <div>
                                  <span style={{ ...labelSm, color: '#a16207' }}>Nueva prenda</span>
                                  <select
                                    value={det.prenda_cambio_id || ''}
                                    onChange={(e) =>
                                      actualizarCambio(index, { prenda_cambio_id: e.target.value })
                                    }
                                    style={{ ...inputBase, fontSize: '0.88rem' }}
                                  >
                                    <option value="">Seleccionar…</option>
                                    {prendas.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <span style={{ ...labelSm, color: '#a16207' }}>Nueva talla</span>
                                  <select
                                    value={det.talla_cambio_id || ''}
                                    onChange={(e) =>
                                      actualizarCambio(index, { talla_cambio_id: e.target.value })
                                    }
                                    style={{ ...inputBase, fontSize: '0.88rem' }}
                                  >
                                    <option value="">Seleccionar…</option>
                                    {tallas.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <span style={{ ...labelSm, color: '#a16207' }}>Cantidad cambio</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={det.cantidad_cambio || det.cantidad_devuelta}
                                    onChange={(e) =>
                                      actualizarCambio(index, {
                                        cantidad_cambio: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    style={inputBase}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                padding: '1rem 1.15rem',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                background: 'linear-gradient(135deg, #f8fafc 0%, #fff 100%)',
                marginBottom: '1rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontWeight: 800,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={reembolsoAplicado}
                  onChange={(e) => setReembolsoAplicado(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#0d9488' }}
                />
                Aplicar reembolso económico
              </label>
              {reembolsoAplicado && (
                <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Monto</span>
                  <input
                    type="number"
                    min={0}
                    max={totalDevolucion}
                    step={0.01}
                    value={montoReembolsado}
                    onChange={(e) => setMontoReembolsado(parseFloat(e.target.value) || 0)}
                    style={{ ...inputBase, width: 160 }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Máx. ${(totalDevolucion || 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '1rem 1.15rem',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #ccfbf1 0%, #e0f2fe 100%)',
                border: '1px solid #99f6e4',
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: '#0f766e' }}>
                TOTAL DEVOLUCIÓN
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                ${(totalDevolucion || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <footer
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              background: 'linear-gradient(180deg, #fafafa 0%, #fff 100%)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#fff',
                fontWeight: 700,
                color: '#475569',
                cursor: guardando ? 'not-allowed' : 'pointer',
              }}
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={guardando || detalles.filter((d) => d.seleccionado).length === 0}
              style={{
                padding: '0.65rem 1.35rem',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #0d9488 0%, #0e7490 55%, #1e40af 100%)',
                color: '#fff',
                fontWeight: 800,
                cursor:
                  guardando || detalles.filter((d) => d.seleccionado).length === 0
                    ? 'not-allowed'
                    : 'pointer',
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
              }}
            >
              {guardando ? 'Guardando…' : 'Registrar devolución'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

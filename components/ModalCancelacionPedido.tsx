'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ModalCancelacionPedidoProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: any;
  onSuccess?: () => void;
}

type ItemCancelacion = {
  detalle_pedido_id: string;
  prenda_nombre: string;
  talla_nombre: string;
  cantidad_total: number;
  pendiente: number;
  cantidad_cancelar: number;
  seleccionado: boolean;
};

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10050,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 27, 75, 0.65) 100%)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
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
    '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.06) inset',
  animation: 'modalFadeIn 0.28s ease',
};

const headerGradient: CSSProperties = {
  padding: '1.25rem 1.5rem',
  background: 'linear-gradient(135deg, #be123c 0%, #881337 45%, #4c0519 100%)',
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
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

export default function ModalCancelacionPedido({
  isOpen,
  onClose,
  pedido,
  onSuccess,
}: ModalCancelacionPedidoProps) {
  const { sesion } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modo, setModo] = useState<'TOTAL' | 'PARCIAL'>('TOTAL');
  const [items, setItems] = useState<ItemCancelacion[]>([]);

  useEffect(() => {
    if (!isOpen || !pedido?.detalles) return;
    const inicial: ItemCancelacion[] = (pedido.detalles as any[]).map((d: any) => ({
      detalle_pedido_id: d.id,
      prenda_nombre: d.prenda_nombre || d.prenda || 'Prenda',
      talla_nombre: d.talla_nombre || d.talla || 'Talla',
      cantidad_total: d.cantidad ?? d.cantidad_original ?? 0,
      pendiente: d.pendiente ?? 0,
      cantidad_cancelar: d.cantidad ?? d.cantidad_original ?? 0,
      seleccionado: true,
    }));
    setItems(inicial);
    setModo('TOTAL');
    setMotivo('');
  }, [isOpen, pedido]);

  useEffect(() => {
    if (!isOpen) return;
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        seleccionado: modo === 'TOTAL' ? true : it.seleccionado,
        cantidad_cancelar: modo === 'TOTAL' ? it.cantidad_total : it.cantidad_cancelar,
      }))
    );
  }, [modo, isOpen]);

  const itemsSeleccionados = useMemo(
    () => items.filter((it) => it.seleccionado && it.cantidad_cancelar > 0),
    [items]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesion) {
      alert('No hay sesión activa');
      return;
    }
    if (!pedido?.id) {
      alert('Pedido inválido');
      return;
    }
    if (itemsSeleccionados.length === 0) {
      alert('Selecciona al menos una partida a cancelar');
      return;
    }

    setGuardando(true);
    try {
      const payload =
        modo === 'TOTAL'
          ? null
          : itemsSeleccionados.map((it) => ({
              detalle_pedido_id: it.detalle_pedido_id,
              cantidad_cancelar: it.cantidad_cancelar,
            }));

      const { data, error } = await supabase.rpc('cancelar_pedido_atomico', {
        p_pedido_id: pedido.id,
        p_usuario_id: (sesion as any).usuario_id ?? null,
        p_items: payload,
        p_motivo: motivo || null,
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Error al cancelar pedido');
      }

      alert(`✅ ${data?.message || 'Cancelación aplicada'}`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`❌ Error al cancelar: ${err.message || err}`);
    } finally {
      setGuardando(false);
    }
  };

  const toggle = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, seleccionado: !it.seleccionado } : it))
    );
  };

  const setCantidad = (idx: number, qty: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, cantidad_cancelar: Math.max(0, Math.min(qty, it.cantidad_total)) }
          : it
      )
    );
  };

  const bump = (idx: number, delta: number) => {
    const it = items[idx];
    if (!it) return;
    setCantidad(idx, it.cantidad_cancelar + delta);
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={overlay} onClick={onClose} role="presentation">
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <header style={headerGradient}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                flexShrink: 0,
              }}
              aria-hidden
            >
              ⛔
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Cancelación de pedido
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', opacity: 0.92 }}>
                Ajusta inventario según lo que canceles (total o por partida).
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
              background: 'rgba(255,255,255,0.15)',
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

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <div
            style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
              background: 'linear-gradient(180deg, #f8fafc 0%, #fff 120px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'stretch',
                marginBottom: '1.25rem',
                padding: '1rem 1.15rem',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <span style={labelSm}>Pedido</span>
                <div
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: '#0f172a',
                  }}
                >
                  {pedido?.folio || `#${String(pedido?.id).slice(0, 8)}…`}
                </div>
              </div>
              <div style={{ flex: '2 1 280px' }}>
                <span style={labelSm}>Cliente</span>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>
                  {pedido?.cliente_nombre || pedido?.cliente || 'N/A'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <span style={labelSm}>Total</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  ${(pedido?.total || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <label style={labelSm}>Tipo de cancelación</label>
                <select
                  value={modo}
                  onChange={(e) => setModo(e.target.value as 'TOTAL' | 'PARCIAL')}
                  style={{ ...inputBase, cursor: 'pointer' }}
                >
                  <option value="TOTAL">Todo el pedido</option>
                  <option value="PARCIAL">Solo algunas partidas</option>
                </select>
              </div>
              <div>
                <label style={labelSm}>Motivo (opcional)</label>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Cliente canceló, error de captura…"
                  style={inputBase}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: '0.65rem',
                }}
              >
                <span style={{ ...labelSm, marginBottom: 0 }}>Partidas</span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {modo === 'TOTAL' ? 'Se cancelará el pedido completo' : 'Marca cantidades a anular'}
                </span>
              </div>
              <div
                style={{
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  background: '#fff',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                {items.map((it, idx) => {
                  const entregado = Math.max(0, it.cantidad_total - it.pendiente);
                  const active = it.seleccionado;
                  return (
                    <div
                      key={it.detalle_pedido_id}
                      style={{
                        padding: '1rem 1.15rem',
                        borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: active
                          ? 'linear-gradient(90deg, #fff1f2 0%, #fff 40%)'
                          : '#fff',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.85rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.65rem',
                            cursor: modo === 'TOTAL' ? 'default' : 'pointer',
                            flex: '1 1 220px',
                            minWidth: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={it.seleccionado}
                            onChange={() => toggle(idx)}
                            disabled={modo === 'TOTAL'}
                            style={{
                              width: 20,
                              height: 20,
                              marginTop: 3,
                              accentColor: '#be123c',
                              cursor: modo === 'TOTAL' ? 'not-allowed' : 'pointer',
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: '1rem',
                                color: '#0f172a',
                                lineHeight: 1.3,
                              }}
                            >
                              {it.prenda_nombre}
                              <span style={{ color: '#94a3b8', fontWeight: 600 }}> · </span>
                              <span style={{ color: '#475569' }}>Talla {it.talla_nombre}</span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.4rem',
                                marginTop: '0.5rem',
                              }}
                            >
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
                                Pedido {it.cantidad_total}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: 999,
                                  background: '#fef3c7',
                                  color: '#92400e',
                                }}
                              >
                                Pendiente {it.pendiente}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: 999,
                                  background: '#dcfce7',
                                  color: '#166534',
                                }}
                              >
                                Entregado {entregado}
                              </span>
                            </div>
                          </div>
                        </label>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginLeft: 'auto',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                            Quitar
                          </span>
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
                              onClick={() => bump(idx, -1)}
                              disabled={!it.seleccionado || modo === 'TOTAL' || it.cantidad_cancelar <= 0}
                              style={{
                                width: 36,
                                height: 36,
                                border: 'none',
                                background: 'transparent',
                                cursor:
                                  !it.seleccionado || modo === 'TOTAL' || it.cantidad_cancelar <= 0
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontSize: '1.1rem',
                                color: '#64748b',
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={it.cantidad_total}
                              value={it.cantidad_cancelar}
                              disabled={!it.seleccionado || modo === 'TOTAL'}
                              onChange={(e) => setCantidad(idx, parseInt(e.target.value) || 0)}
                              style={{
                                width: 48,
                                border: 'none',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                background: '#fff',
                                padding: '0.35rem 0',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => bump(idx, 1)}
                              disabled={
                                !it.seleccionado ||
                                modo === 'TOTAL' ||
                                it.cantidad_cancelar >= it.cantidad_total
                              }
                              style={{
                                width: 36,
                                height: 36,
                                border: 'none',
                                background: 'transparent',
                                cursor:
                                  !it.seleccionado ||
                                  modo === 'TOTAL' ||
                                  it.cantidad_cancelar >= it.cantidad_total
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontSize: '1.1rem',
                                color: '#64748b',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
              disabled={guardando}
              style={{
                padding: '0.65rem 1.35rem',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #be123c 0%, #9f1239 100%)',
                color: '#fff',
                fontWeight: 800,
                cursor: guardando ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(190, 18, 60, 0.35)',
              }}
            >
              {guardando ? 'Aplicando…' : 'Confirmar cancelación'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

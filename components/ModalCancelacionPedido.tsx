'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ModalCancelacionPedidoProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: any; // pedido + detalles enriquecidos
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

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h2>⛔ Cancelación de Pedido</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700 }}>
                Pedido: {pedido?.folio || `#${String(pedido?.id).slice(0, 8)}…`}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                Cliente: {pedido?.cliente_nombre || pedido?.cliente || 'N/A'} | Total: $
                {(pedido?.total || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Tipo de cancelación
                </label>
                <select
                  value={modo}
                  onChange={(e) => setModo(e.target.value as any)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}
                >
                  <option value="TOTAL">Cancelar todo el pedido</option>
                  <option value="PARCIAL">Cancelar algunas partidas</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Motivo (opcional)
                </label>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Cliente canceló / Error de captura"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>
            </div>

            <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
              {items.map((it, idx) => (
                <div
                  key={it.detalle_pedido_id}
                  style={{
                    padding: '0.85rem',
                    borderBottom: idx < items.length - 1 ? '1px solid #eee' : 'none',
                    background: it.seleccionado ? '#fff7ed' : 'white',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={it.seleccionado}
                      onChange={() => toggle(idx)}
                      disabled={modo === 'TOTAL'}
                      style={{ width: 18, height: 18 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>
                        {it.prenda_nombre} — {it.talla_nombre}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        Cantidad: {it.cantidad_total} | Pendiente: {it.pendiente} | Entregado: {Math.max(0, it.cantidad_total - it.pendiente)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Cancelar</span>
                      <input
                        type="number"
                        min={0}
                        max={it.cantidad_total}
                        value={it.cantidad_cancelar}
                        disabled={!it.seleccionado || modo === 'TOTAL'}
                        onChange={(e) => setCantidad(idx, parseInt(e.target.value) || 0)}
                        style={{ width: 90, padding: '0.4rem', borderRadius: '6px', border: '1px solid #ddd' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={guardando}>
              Cerrar
            </button>
            <button type="submit" className="btn-danger" disabled={guardando}>
              {guardando ? '⏳ Aplicando...' : '⛔ Cancelar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}


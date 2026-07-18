'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import SelectorPrendasTransferencia, {
  type LineaTransferenciaSeleccionada,
} from '@/components/transferencias/SelectorPrendasTransferencia';

export type PartidaComplementaria = {
  id: string;
  cantidad: number;
  prenda_id: string;
  talla_id: string;
  costo_id: string;
  prenda_nombre: string;
  talla_nombre: string;
};

interface Props {
  transferenciaId: string;
  folio: string;
  partida: PartidaComplementaria;
  onClose: () => void;
  onOk: () => void;
}

export default function ModalReenviarComplementario({
  transferenciaId,
  folio,
  partida,
  onClose,
  onOk,
}: Props) {
  const { sesion } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cambiar, setCambiar] = useState(false);
  const [lineas, setLineas] = useState<LineaTransferenciaSeleccionada[]>([]);

  const handleSeleccion = useCallback((nuevas: LineaTransferenciaSeleccionada[]) => {
    setLineas(nuevas);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const reenviar = async (linea?: LineaTransferenciaSeleccionada) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        transferencia_id: transferenciaId,
        detalle_id: partida.id,
      };
      if (linea) {
        body.linea = {
          prenda_id: linea.prenda_id,
          talla_id: linea.talla_id,
          cantidad: linea.cantidad,
          costo_id: linea.costo_id,
        };
      }

      const res = await fetch('/api/transferencias/reenviar-complementario', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? 'No se pudo reenviar la partida.');
      }
      onOk();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reenviar.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 10050 }}>
      <div
        className="modal-content"
        style={{ maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>✏️ Corregir y reenviar — {folio}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '0.75rem',
                borderRadius: 8,
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              Enviado incorrecto / no recibido
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', marginTop: '0.35rem' }}>
              {partida.prenda_nombre} — Talla {partida.talla_nombre}
            </div>
            <div style={{ color: '#7f1d1d', marginTop: '0.25rem' }}>Cantidad: {partida.cantidad}</div>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: 0 }}>
            Desde <strong>{sesion?.sucursal_nombre}</strong> puedes reenviar la misma partida o cambiarla. Al
            reenviar vuelve a <strong>en tránsito</strong> para que el destino la reciba.
          </p>

          {!cambiar ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={() => void reenviar()}
              >
                {loading ? '⏳ Reenviando…' : '🚚 Reenviar igual'}
              </button>
              <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => setCambiar(true)}>
                Cambiar prenda / cantidad
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
                Elige exactamente <strong>1 talla</strong> con la cantidad a reenviar.
              </p>
              <SelectorPrendasTransferencia
                origenId={sesion?.sucursal_id ?? ''}
                origenNombre={sesion?.sucursal_nombre}
                habilitado={Boolean(sesion?.sucursal_id)}
                onSeleccionChange={handleSeleccion}
                soloSeleccionadasInicial={false}
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => setCambiar(false)}>
                  Cancelar cambio
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading || lineas.length !== 1}
                  onClick={() => {
                    if (lineas.length === 1) void reenviar(lineas[0]);
                  }}
                >
                  {loading ? '⏳ Reenviando…' : '🚚 Reenviar corregido'}
                </button>
              </div>
              {lineas.length > 1 && (
                <p style={{ color: '#b45309', fontSize: '0.85rem' }}>Deja solo una talla seleccionada.</p>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Transferencia } from '@/lib/types';

interface ModalDetalleTransferenciaProps {
  transferencia: Transferencia;
  onClose: () => void;
  onRecibida?: () => void;
}

type DetalleRow = {
  id: string;
  cantidad: number;
  prenda_nombre: string;
  talla_nombre: string;
};

export default function ModalDetalleTransferencia({
  transferencia,
  onClose,
  onRecibida,
}: ModalDetalleTransferenciaProps) {
  const { sesion } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [detalles, setDetalles] = useState<DetalleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recibiendo, setRecibiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeRecibir =
    String(transferencia.sucursal_destino_id) === sesion?.sucursal_id &&
    (transferencia.estado === 'EN_TRANSITO' || transferencia.estado === 'PENDIENTE');

  useEffect(() => {
    setMounted(true);
    void cargarDetalle();
  }, [transferencia.id]);

  const cargarDetalle = async () => {
    setLoading(true);
    try {
      const { data: filas, error: err } = await insforgeDb()
        .from('detalle_transferencias')
        .select('id, cantidad, prenda_id, talla_id')
        .eq('transferencia_id', transferencia.id);

      if (err) throw err;

      const prendaIds = [...new Set((filas || []).map((f) => String(f.prenda_id)).filter(Boolean))];
      const tallaIds = [...new Set((filas || []).map((f) => String(f.talla_id)).filter(Boolean))];

      const [preRes, taRes] = await Promise.all([
        prendaIds.length
          ? insforgeDb().from('prendas').select('id, nombre').in('id', prendaIds)
          : Promise.resolve({ data: [] }),
        tallaIds.length
          ? insforgeDb().from('tallas').select('id, nombre').in('id', tallaIds)
          : Promise.resolve({ data: [] }),
      ]);

      const preMap = new Map(
        (preRes.data || []).map((p) => [String((p as { id: string }).id).toLowerCase(), (p as { nombre?: string }).nombre ?? ''])
      );
      const taMap = new Map(
        (taRes.data || []).map((t) => [String((t as { id: string }).id).toLowerCase(), (t as { nombre?: string }).nombre ?? ''])
      );

      setDetalles(
        (filas || []).map((f) => ({
          id: String(f.id),
          cantidad: Number(f.cantidad ?? 0),
          prenda_nombre: preMap.get(String(f.prenda_id).toLowerCase()) ?? 'Prenda',
          talla_nombre: taMap.get(String(f.talla_id).toLowerCase()) ?? 'Talla',
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecibir = async () => {
    setRecibiendo(true);
    setError(null);
    try {
      const res = await fetch('/api/transferencias/recibir', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferencia_id: transferencia.id }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? 'No se pudo recibir la transferencia.');
      }
      onRecibida?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recibir.');
    } finally {
      setRecibiendo(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 Transferencia {transferencia.folio}</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <p>
            <strong>Estado:</strong> {transferencia.estado}
          </p>
          <p>
            <strong>Origen:</strong> {transferencia.sucursal_origen?.nombre ?? '—'} →{' '}
            <strong>Destino:</strong> {transferencia.sucursal_destino?.nombre ?? '—'}
          </p>
          {transferencia.observaciones && (
            <p style={{ color: '#64748b' }}>
              <strong>Notas:</strong> {transferencia.observaciones}
            </p>
          )}

          <h3 style={{ marginTop: '1.25rem', marginBottom: '0.75rem' }}>Detalle</h3>
          {loading ? (
            <p>Cargando…</p>
          ) : detalles.length === 0 ? (
            <p style={{ color: '#64748b' }}>Sin partidas.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Prenda</th>
                  <th>Talla</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map((d) => (
                  <tr key={d.id}>
                    <td>{d.prenda_nombre}</td>
                    <td>{d.talla_nombre}</td>
                    <td>{d.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {puedeRecibir && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                background: '#eff6ff',
                borderRadius: '8px',
                color: '#1e40af',
              }}
            >
              Al confirmar, el inventario se sumará a <strong>{sesion?.sucursal_nombre}</strong> y podrás verlo en Prendas y
              Costos.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          {puedeRecibir && (
            <button type="button" className="btn btn-primary" onClick={handleRecibir} disabled={recibiendo || loading}>
              {recibiendo ? '⏳ Recibiendo…' : '✅ Confirmar recepción'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

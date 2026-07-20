'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import ModalTransferencia from '@/components/ModalTransferencia';
import ModalDetalleTransferencia from '@/components/ModalDetalleTransferencia';
import { useTransferencias } from '@/lib/hooks/useTransferencias';
import type { Transferencia } from '@/lib/types';

export default function TransferenciasPage() {
  const { sesion } = useAuth();
  const { transferencias, loading, recargar } = useTransferencias(sesion?.sucursal_id);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [transferenciaEditar, setTransferenciaEditar] = useState<Transferencia | null>(null);
  const [transferenciaDetalle, setTransferenciaDetalle] = useState<Transferencia | null>(null);

  const handleNuevaTransferencia = () => {
    setTransferenciaEditar(null);
    setModalAbierto(true);
  };

  const handleCerrarModal = () => {
    setModalAbierto(false);
    setTransferenciaEditar(null);
    recargar();
  };

  const getBadgeEstado = (estado: string) => {
    const badges = {
      PENDIENTE: { bg: '#fef3c7', color: '#92400e', emoji: '⏳', label: 'PENDIENTE' },
      EN_TRANSITO: { bg: '#dbeafe', color: '#1e40af', emoji: '🚚', label: 'EN_TRANSITO' },
      RECIBIDA: { bg: '#d1fae5', color: '#065f46', emoji: '✅', label: 'RECIBIDA' },
      RECIBIDA_PARCIAL: { bg: '#ffedd5', color: '#c2410c', emoji: '◐', label: 'RECIBIDO PARCIAL' },
      CANCELADA: { bg: '#fee2e2', color: '#991b1b', emoji: '❌', label: 'CANCELADA' },
    };
    return badges[estado as keyof typeof badges] || badges.PENDIENTE;
  };

  const esDestinoPendiente = (t: Transferencia) =>
    String(t.sucursal_destino_id) === sesion?.sucursal_id &&
    (t.estado === 'EN_TRANSITO' || t.estado === 'PENDIENTE' || t.estado === 'RECIBIDA_PARCIAL');

  const puedeModificar = (t: Transferencia) =>
    t.estado === 'EN_TRANSITO' && String(t.sucursal_origen_id) === sesion?.sucursal_id;

  const puedeCancelar = (t: Transferencia) =>
    String(t.sucursal_origen_id) === sesion?.sucursal_id &&
    (t.estado === 'EN_TRANSITO' || t.estado === 'PENDIENTE' || t.estado === 'RECIBIDA_PARCIAL');

  const cancelarTransferencia = async (t: Transferencia) => {
    const ok = confirm(
      `¿Cancelar ${t.folio}?\n\nLas partidas en tránsito regresarán al inventario de origen. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      const res = await fetch('/api/transferencias/cancelar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferencia_id: t.id }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? 'No se pudo cancelar.');
      alert(json.message ?? 'Transferencia cancelada.');
      recargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cancelar.');
    }
  };

  const limpiarVacias = async () => {
    try {
      const res = await fetch('/api/transferencias/limpiar-sin-partidas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; canceladas?: string[] };
      if (!res.ok || !json.ok) {
        window.alert(json.message ?? 'No se pudieron limpiar.');
        return;
      }
      window.alert(json.message ?? 'Listo.');
      recargar();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al limpiar.');
    }
  };

  return (
    <LayoutWrapper>
      <div className="main-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <h1 className="page-title">
            🚚 Transferencias de Mercancía
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button" onClick={handleNuevaTransferencia}>
              ➕ Nueva Transferencia
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void limpiarVacias()}
              title="Cancela transferencias EN_TRANSITO que no tengan partidas"
            >
              🧹 Limpiar vacías
            </button>
          </div>
        </div>

        <div
          className="alert alert-info"
          style={{
            marginBottom: '2rem',
            background: '#ffffff',
            color: '#334155',
            border: '1px solid #dbeafe',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
          }}
        >
          ℹ️ Las transferencias son <strong style={{ color: '#1e40af' }}>bidireccionales</strong>: matriz ↔ sucursal. Quien envía elige prendas de su inventario;
          quien recibe confirma con <strong style={{ color: '#1e40af' }}>Confirmar recepción</strong> para que el stock aparezca en su tienda.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner"></div>
            <p>Cargando transferencias...</p>
          </div>
        ) : transferencias.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚚</div>
            <h3>No hay transferencias registradas</h3>
            <p>
              Crea una transferencia hacia otra tienda (matriz o sucursal) usando el botón de arriba.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transferencias.map((transferencia) => {
                  const badge = getBadgeEstado(transferencia.estado);
                  return (
                    <tr key={transferencia.id}>
                      <td>
                        <code style={{
                          background: '#f3f4f6',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                        }}>
                          {transferencia.folio}
                        </code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {transferencia.sucursal_origen?.es_matriz ? '🏛️' : '📍'}
                          <span style={{ fontWeight: '600' }}>
                            {transferencia.sucursal_origen?.nombre}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {transferencia.sucursal_destino?.es_matriz ? '🏛️' : '📍'}
                          <span style={{ fontWeight: '600' }}>
                            {transferencia.sucursal_destino?.nombre}
                          </span>
                        </div>
                      </td>
                      <td>
                        {new Date(transferencia.fecha_transferencia).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td>
                        <span style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                        }}>
                          {badge.emoji} {badge.label ?? transferencia.estado}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                            onClick={() => setTransferenciaDetalle(transferencia)}
                          >
                            👁️ Ver
                          </button>
                          {puedeModificar(transferencia) && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                              onClick={() => {
                                setTransferenciaEditar(transferencia);
                                setModalAbierto(true);
                              }}
                            >
                              ✏️ Modificar
                            </button>
                          )}
                          {puedeCancelar(transferencia) && (
                            <button
                              className="btn"
                              style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.9rem',
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fecaca',
                              }}
                              onClick={() => void cancelarTransferencia(transferencia)}
                            >
                              ❌ Cancelar
                            </button>
                          )}
                          {esDestinoPendiente(transferencia) && (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                              onClick={() => setTransferenciaDetalle(transferencia)}
                            >
                              ✅ Recibir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalTransferencia
          onClose={handleCerrarModal}
          transferenciaEditar={transferenciaEditar}
        />
      )}

      {transferenciaDetalle && (
        <ModalDetalleTransferencia
          transferencia={transferenciaDetalle}
          onClose={() => setTransferenciaDetalle(null)}
          onRecibida={recargar}
        />
      )}
    </LayoutWrapper>
  );
}

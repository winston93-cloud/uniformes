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
  const [transferenciaDetalle, setTransferenciaDetalle] = useState<Transferencia | null>(null);

  const handleNuevaTransferencia = () => {
    setModalAbierto(true);
  };

  const handleCerrarModal = () => {
    setModalAbierto(false);
    recargar();
  };

  const getBadgeEstado = (estado: string) => {
    const badges = {
      PENDIENTE: { bg: '#fef3c7', color: '#92400e', emoji: '⏳' },
      EN_TRANSITO: { bg: '#dbeafe', color: '#1e40af', emoji: '🚚' },
      RECIBIDA: { bg: '#d1fae5', color: '#065f46', emoji: '✅' },
      CANCELADA: { bg: '#fee2e2', color: '#991b1b', emoji: '❌' },
    };
    return badges[estado as keyof typeof badges] || badges.PENDIENTE;
  };

  const esDestinoPendiente = (t: Transferencia) =>
    !sesion?.es_matriz &&
    String(t.sucursal_destino_id) === sesion?.sucursal_id &&
    (t.estado === 'EN_TRANSITO' || t.estado === 'PENDIENTE');

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
          {sesion?.es_matriz && (
            <button 
              className="btn btn-primary"
              onClick={handleNuevaTransferencia}
            >
              ➕ Nueva Transferencia
            </button>
          )}
        </div>

        {!sesion?.es_matriz && (
          <div className="alert alert-info" style={{ marginBottom: '2rem' }}>
            ℹ️ Las transferencias las envía la matriz. Cuando llegue mercancía, ábrela y pulsa <strong>Confirmar recepción</strong> para que aparezca en tu inventario.
          </div>
        )}

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
              {sesion?.es_matriz 
                ? 'Comienza creando la primera transferencia hacia una sucursal.' 
                : 'Las transferencias aparecerán aquí cuando la matriz las envíe.'}
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
                          {badge.emoji} {transferencia.estado}
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
        <ModalTransferencia onClose={handleCerrarModal} />
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

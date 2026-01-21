'use client';

import { useState, useEffect } from 'react';
import { useComprasInsumos, type NuevaCompraInsumo } from '@/lib/hooks/useComprasInsumos';

interface ModalRegistrarCompraProps {
  insumo_id: string;
  insumo_nombre: string;
  presentacion_nombre: string;
  cantidad_faltante: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalRegistrarCompra({
  insumo_id,
  insumo_nombre,
  presentacion_nombre,
  cantidad_faltante,
  onClose,
  onSuccess,
}: ModalRegistrarCompraProps) {
  const { crearCompra } = useComprasInsumos();
  
  const [formData, setFormData] = useState<NuevaCompraInsumo>({
    insumo_id,
    cantidad_comprada: cantidad_faltante,
    costo_unitario: 0,
    proveedor: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    notas: '',
  });
  
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costoTotal = formData.cantidad_comprada * (formData.costo_unitario || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.cantidad_comprada <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    setGuardando(true);
    setError(null);

    const exito = await crearCompra({
      ...formData,
      costo_total: costoTotal,
    });

    setGuardando(false);

    if (exito) {
      onSuccess();
      onClose();
    } else {
      setError('Error al registrar la compra');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💰 Registrar Compra de Insumo</h2>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        <div className="modal-body">
          <div className="info-box">
            <p><strong>Insumo:</strong> {insumo_nombre}</p>
            <p><strong>Cantidad Faltante:</strong> {cantidad_faltante.toFixed(2)} {presentacion_nombre}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Cantidad Comprada */}
            <div className="form-group">
              <label htmlFor="cantidad">
                Cantidad Comprada ({presentacion_nombre}) *
              </label>
              <input
                type="number"
                id="cantidad"
                step="0.01"
                min="0.01"
                value={formData.cantidad_comprada}
                onChange={(e) => setFormData({
                  ...formData,
                  cantidad_comprada: parseFloat(e.target.value) || 0
                })}
                required
                className="form-input"
              />
            </div>

            {/* Costo Unitario */}
            <div className="form-group">
              <label htmlFor="costo_unitario">
                Costo Unitario ($)
              </label>
              <input
                type="number"
                id="costo_unitario"
                step="0.01"
                min="0"
                value={formData.costo_unitario}
                onChange={(e) => setFormData({
                  ...formData,
                  costo_unitario: parseFloat(e.target.value) || 0
                })}
                className="form-input"
              />
            </div>

            {/* Costo Total (Calculado) */}
            <div className="form-group">
              <label>Costo Total</label>
              <div className="form-input-readonly">
                ${costoTotal.toFixed(2)}
              </div>
            </div>

            {/* Proveedor */}
            <div className="form-group">
              <label htmlFor="proveedor">Proveedor</label>
              <input
                type="text"
                id="proveedor"
                value={formData.proveedor}
                onChange={(e) => setFormData({
                  ...formData,
                  proveedor: e.target.value
                })}
                placeholder="Nombre del proveedor"
                className="form-input"
              />
            </div>

            {/* Fecha de Compra */}
            <div className="form-group">
              <label htmlFor="fecha">Fecha de Compra *</label>
              <input
                type="date"
                id="fecha"
                value={formData.fecha_compra}
                onChange={(e) => setFormData({
                  ...formData,
                  fecha_compra: e.target.value
                })}
                required
                className="form-input"
              />
            </div>

            {/* Notas */}
            <div className="form-group">
              <label htmlFor="notas">Notas</label>
              <textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({
                  ...formData,
                  notas: e.target.value
                })}
                placeholder="Número de factura, condiciones, etc."
                rows={3}
                className="form-input"
              />
            </div>

            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : '💾 Registrar Compra'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #1f2937;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-close:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .info-box {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .info-box p {
          margin: 0.5rem 0;
          color: #0c4a6e;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #374151;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-input-readonly {
          width: 100%;
          padding: 0.75rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 1.2rem;
          font-weight: bold;
          color: #059669;
        }

        textarea.form-input {
          resize: vertical;
          font-family: inherit;
        }

        .error-message {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-size: 1rem;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}

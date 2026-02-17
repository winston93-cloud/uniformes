'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { crearTransferencia } from '@/lib/hooks/useTransferencias';
import { supabase } from '@/lib/supabase';

interface ModalTransferenciaProps {
  onClose: () => void;
}

export default function ModalTransferencia({ onClose }: ModalTransferenciaProps) {
  const { sesion } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sucursales, setSucursales] = useState<any[]>([]);
  const [prendas, setPrendas] = useState<any[]>([]);
  
  const [sucursalDestinoId, setSucursalDestinoId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [detalles, setDetalles] = useState<Array<{
    prenda_id: string;
    talla_id: string;
    cantidad: number;
    costo_id: string;
  }>>([]);

  useEffect(() => {
    setMounted(true);
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    // Cargar sucursales (excepto la actual)
    const { data: sucursalesData } = await supabase
      .from('sucursales')
      .select('*')
      .eq('activo', true)
      .neq('id', sesion?.sucursal_id)
      .order('nombre');

    if (sucursalesData) setSucursales(sucursalesData);

    // Cargar prendas activas
    const { data: prendasData } = await supabase
      .from('prendas')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (prendasData) setPrendas(prendasData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (detalles.length === 0) {
        setError('Debes agregar al menos una prenda');
        setLoading(false);
        return;
      }

      await crearTransferencia(
        sesion!.sucursal_id,
        sucursalDestinoId,
        sesion!.usuario_id,
        detalles,
        observaciones || undefined
      );
      
      onClose();
    } catch (err) {
      console.error('Error creando transferencia:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content"
        style={{ maxWidth: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>🚚 Nueva Transferencia de Mercancía</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                color: '#991b1b',
              }}>
                ❌ {error}
              </div>
            )}

            {/* Info de origen */}
            <div style={{
              background: '#f0fdf4',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '2px solid #86efac',
            }}>
              <strong>📤 Origen:</strong> {sesion?.sucursal_nombre}
            </div>

            {/* Sucursal destino */}
            <div className="form-group">
              <label className="form-label">
                Sucursal Destino <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                className="form-input"
                value={sucursalDestinoId}
                onChange={(e) => setSucursalDestinoId(e.target.value)}
                required
              >
                <option value="">Selecciona una sucursal...</option>
                {sucursales.map((suc) => (
                  <option key={suc.id} value={suc.id}>
                    {suc.es_matriz ? '🏛️' : '📍'} {suc.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Observaciones */}
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-input"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales sobre la transferencia..."
                rows={3}
              />
            </div>

            {/* Info de próximo paso */}
            <div style={{
              background: '#eff6ff',
              padding: '1rem',
              borderRadius: '8px',
              marginTop: '1.5rem',
              color: '#1e40af',
            }}>
              ℹ️ <strong>Próximamente:</strong> Podrás agregar prendas y cantidades a la transferencia.
              Por ahora, la transferencia se creará vacía y podrás agregar detalles después.
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !sucursalDestinoId}
            >
              {loading ? '⏳ Creando...' : '🚚 Crear Transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

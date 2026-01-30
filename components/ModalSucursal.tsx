'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { crearSucursal, actualizarSucursal } from '@/lib/hooks/useSucursales';
import { Sucursal } from '@/lib/types';

interface ModalSucursalProps {
  sucursal?: Sucursal | null;
  onClose: () => void;
}

export default function ModalSucursal({ sucursal, onClose }: ModalSucursalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    direccion: '',
    telefono: '',
    es_matriz: false,
    activo: true,
  });

  useEffect(() => {
    setMounted(true);
    if (sucursal) {
      setFormData({
        codigo: sucursal.codigo,
        nombre: sucursal.nombre,
        direccion: sucursal.direccion || '',
        telefono: sucursal.telefono || '',
        es_matriz: sucursal.es_matriz,
        activo: sucursal.activo,
      });
    }
  }, [sucursal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (sucursal) {
        await actualizarSucursal(sucursal.id, formData);
      } else {
        await crearSucursal(formData);
      }
      onClose();
    } catch (err) {
      console.error('Error guardando sucursal:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div 
      className="modal-overlay"
      onClick={onClose}
    >
      <div 
        className="modal-content"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{sucursal ? '✏️ Editar Sucursal' : '➕ Nueva Sucursal'}</h2>
          <button 
            className="modal-close" 
            onClick={onClose}
            type="button"
          >
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

            <div className="form-grid">
              {/* Código */}
              <div className="form-group">
                <label className="form-label">
                  Código <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="MAT-MAD, MAT-CEN, PV-WIN"
                  required
                  maxLength={20}
                />
                <small style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  Código único de la sucursal
                </small>
              </div>

              {/* Nombre */}
              <div className="form-group">
                <label className="form-label">
                  Nombre <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Matriz Madero, Matriz Centro, etc."
                  required
                  maxLength={100}
                />
              </div>
            </div>

            {/* Dirección */}
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <textarea
                className="form-input"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Calle, número, colonia, ciudad"
                rows={3}
              />
            </div>

            {/* Teléfono */}
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="tel"
                className="form-input"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="555-123-4567"
                maxLength={20}
              />
            </div>

            {/* Checkboxes */}
            <div style={{ 
              display: 'flex', 
              gap: '2rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '8px',
              marginTop: '1rem',
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={formData.es_matriz}
                  onChange={(e) => setFormData({ ...formData, es_matriz: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: '500' }}>
                  🏛️ Es Sucursal Matriz
                </span>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: '500' }}>
                  ✅ Activa
                </span>
              </label>
            </div>

            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#eff6ff',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#1e40af',
            }}>
              ℹ️ <strong>Nota:</strong> La sucursal matriz es donde se encuentran todos los insumos.
              Las demás sucursales solo manejan stock de prendas.
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
              disabled={loading}
            >
              {loading ? '⏳ Guardando...' : sucursal ? '💾 Actualizar' : '➕ Crear Sucursal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

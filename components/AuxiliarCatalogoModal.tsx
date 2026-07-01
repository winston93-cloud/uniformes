'use client';

import type React from 'react';

export type AuxiliarCatalogoModalProps = {
  open: boolean;
  titulo: string;
  nombreLabel?: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  mayusculasNombre?: boolean;
  onNombreChange: (v: string) => void;
  onDescripcionChange: (v: string) => void;
  onActivoChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onDelete?: () => void;
  mostrarEliminar: boolean;
  guardando?: boolean;
  errorLinea?: string | null;
};

export default function AuxiliarCatalogoModal({
  open,
  titulo,
  nombreLabel = 'Nombre',
  nombre,
  descripcion,
  activo,
  mayusculasNombre = false,
  onNombreChange,
  onDescripcionChange,
  onActivoChange,
  onSubmit,
  onClose,
  onDelete,
  mostrarEliminar,
  guardando = false,
  errorLinea,
}: AuxiliarCatalogoModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="form-container"
        style={{
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          margin: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="form-title" style={{ fontSize: '1.25rem' }}>
          {titulo}
        </h2>
        <form onSubmit={onSubmit}>
          {errorLinea && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.9rem',
              }}
            >
              {errorLinea}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{nombreLabel} *</label>
            <input
              type="text"
              className="form-input"
              value={nombre}
              onChange={(e) => onNombreChange(mayusculasNombre ? e.target.value.toUpperCase() : e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-textarea"
              value={descripcion}
              onChange={(e) => onDescripcionChange(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => onActivoChange(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span className="form-label" style={{ marginBottom: 0 }}>
                Activo en listas
              </span>
            </label>
          </div>
          <div className="btn-group acciones-fila" style={{ flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-start', marginTop: '1.5rem' }}>
            {mostrarEliminar && onDelete && (
              <button type="button" className="btn btn-danger" onClick={onDelete} disabled={guardando}>
                🗑️ Eliminar
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : '💾 Guardar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

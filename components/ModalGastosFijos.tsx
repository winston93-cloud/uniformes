'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';

export interface GastoFijo {
  id: string;
  nombre: string;
  monto: number;
}

interface ModalGastosFijosProps {
  onClose: () => void;
}

export default function ModalGastosFijos({ onClose }: ModalGastosFijosProps) {
  const [mounted, setMounted] = useState(false);
  const [gastos, setGastos] = useState<GastoFijo[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = gastos.reduce((sum, g) => sum + (isNaN(g.monto) ? 0 : g.monto), 0);

  const agregarConcepto = () => {
    setGastos([
      ...gastos,
      { id: crypto.randomUUID(), nombre: '', monto: 0 },
    ]);
  };

  const eliminarConcepto = (id: string) => {
    setGastos(gastos.filter((g) => g.id !== id));
  };

  const actualizarGasto = (id: string, campo: 'nombre' | 'monto', valor: string | number) => {
    setGastos(
      gastos.map((g) =>
        g.id === id
          ? {
              ...g,
              [campo]: typeof valor === 'string' && campo === 'monto' ? parseFloat(valor) || 0 : valor,
            }
          : g
      )
    );
  };

  const handleGuardar = () => {
    // TODO: persistir en backend cuando exista la API
    onClose();
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Gastos fijos semanales</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Agrega los conceptos de gasto fijo y sus montos
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={agregarConcepto}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
              }}
            >
              <Plus size={18} />
              Agregar concepto
            </button>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '1.5rem',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    Nombre del gasto
                  </th>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                      width: '140px',
                    }}
                  >
                    Monto ($)
                  </th>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      width: '48px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {gastos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#9ca3af',
                        fontSize: '0.9rem',
                      }}
                    >
                      No hay conceptos. Haz clic en &quot;Agregar concepto&quot; para comenzar.
                    </td>
                  </tr>
                ) : (
                  gastos.map((gasto) => (
                    <tr
                      key={gasto.id}
                      style={{ borderBottom: '1px solid #f3f4f6' }}
                    >
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <input
                          type="text"
                          value={gasto.nombre}
                          onChange={(e) =>
                            actualizarGasto(gasto.id, 'nombre', e.target.value)
                          }
                          placeholder="Ej. Renta, luz, agua..."
                          className="form-input"
                          style={{ margin: 0 }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={gasto.monto || ''}
                          onChange={(e) =>
                            actualizarGasto(gasto.id, 'monto', e.target.value)
                          }
                          placeholder="0.00"
                          className="form-input"
                          style={{ margin: 0, textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => eliminarConcepto(gasto.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            color: '#ef4444',
                            borderRadius: '8px',
                          }}
                          aria-label="Eliminar concepto"
                          title="Eliminar"
                        >
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.25rem',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: '12px',
              border: '1px solid #fcd34d',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#92400e' }}>
              Total:
            </span>
            <span
              style={{
                fontWeight: 800,
                fontSize: '1.5rem',
                color: '#92400e',
              }}
            >
              ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              color: '#6b7280',
            }}
          >
            {gastos.length} concepto{gastos.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleGuardar}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

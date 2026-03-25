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
  const [gastosGuardados, setGastosGuardados] = useState<GastoFijo[]>([]);
  const [cargandoGuardados, setCargandoGuardados] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      setCargandoGuardados(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch('/api/gastos-fijos-semanales/actual');
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || 'No se pudo cargar los gastos guardados');
        }
        if (!json?.success) {
          throw new Error(json?.error || 'No se pudieron cargar los gastos guardados');
        }

        setGastosGuardados(
          (json.gastosGuardados ?? []).map((g: { nombre: string; monto: number }) => ({
            id: crypto.randomUUID(),
            nombre: g.nombre,
            monto: g.monto,
          }))
        );
        // Solo mostrarlos abajo para evitar duplicación: el editor inicia vacío.
        setGastos([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar gastos');
      } finally {
        setCargandoGuardados(false);
      }
    })();
  }, [mounted]);

  const total = gastos.reduce((sum, g) => sum + (isNaN(g.monto) ? 0 : g.monto), 0);
  const totalGuardado = gastosGuardados.reduce((sum, g) => sum + (isNaN(g.monto) ? 0 : g.monto), 0);

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

  const handleGuardar = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const gastosLimpios = gastos
        .map((g) => ({ nombre: g.nombre.trim(), monto: Number(g.monto) }))
        .filter((g) => g.nombre.length > 0 && !Number.isNaN(g.monto) && g.monto >= 0);

      if (gastosLimpios.length === 0) {
        setError('Agrega al menos un concepto con nombre y monto válido.');
        return;
      }

      const res = await fetch('/api/gastos-fijos-semanales/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gastos: gastosLimpios }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || 'No se pudo guardar los gastos');
      }
      if (!json?.success) {
        throw new Error(json?.error || 'No se pudo guardar los gastos');
      }

      const nuevos = (json.gastosGuardados ?? []) as Array<{ nombre: string; monto: number }>;
      setGastosGuardados(
        nuevos.map((g) => ({
          id: crypto.randomUUID(),
          nombre: g.nombre,
          monto: g.monto,
        }))
      );
      // Solo mostrarlos abajo: el editor se limpia luego de guardar.
      setGastos([]);

      setSuccess('Guardado correctamente para la semana actual.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
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
            {gastos.length > 0 ? (
              <>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#92400e' }}>Total:</span>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '1.5rem',
                    color: '#92400e',
                  }}
                >
                  ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </>
            ) : (
              <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>Agrega conceptos arriba y da Guardar</span>
            )}
          </div>

          {gastos.length > 0 && (
            <p
              style={{
                marginTop: '0.75rem',
                fontSize: '0.8rem',
                color: '#6b7280',
              }}
            >
              {gastos.length} concepto{gastos.length !== 1 ? 's' : ''}
            </p>
          )}

          <div
            style={{
              marginTop: '1rem',
              borderTop: '2px solid rgba(29, 78, 216, 0.22)',
              paddingTop: '1rem',
            }}
          >
            <div
              style={{
                fontWeight: 900,
                color: '#1d4ed8',
                marginBottom: '0.75rem',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(245,158,11,0.10) 100%)',
                border: '1px solid rgba(29,78,216,0.22)',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span>Gastos fijos semanales guardados (semana actual)</span>
              {gastosGuardados.length > 0 && (
                <span style={{ color: '#92400e' }}>
                  Total: ${totalGuardado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {cargandoGuardados ? (
              <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Cargando...</div>
            ) : gastosGuardados.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Todavía no hay gastos guardados.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {gastosGuardados.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(229,231,235,1)',
                      background: 'rgba(255,255,255,0.65)',
                    }}
                  >
                    <span style={{ color: '#374151', fontWeight: 700 }}>{g.nombre}</span>
                    <span style={{ color: '#92400e', fontWeight: 900 }}>${g.monto.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleGuardar}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '0.75rem', color: '#b91c1c', fontSize: '0.9rem', padding: '0 1rem 1rem 1rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ marginTop: '0.75rem', color: '#047857', fontSize: '0.9rem', padding: '0 1rem 1rem 1rem' }}>
            {success}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

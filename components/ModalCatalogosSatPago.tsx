'use client';

import { useEffect, useState } from 'react';
import {
  etiquetaSatPago,
  useSatCatalogosPago,
  type SatCatalogoTipo,
} from '@/lib/hooks/useSatCatalogosPago';
import type { SatFormaPago, SatMetodoPago } from '@/lib/types';

interface ModalCatalogosSatPagoProps {
  abierto: boolean;
  onClose: () => void;
}

type FilaSat = SatMetodoPago | SatFormaPago;

const FORM_VACIO = {
  clave: '',
  descripcion: '',
  orden: '0',
  activo: true,
  es_default: false,
};

export default function ModalCatalogosSatPago({ abierto, onClose }: ModalCatalogosSatPagoProps) {
  const { metodos, formas, cargando, error, recargar, guardar, eliminar } = useSatCatalogosPago();
  const [tab, setTab] = useState<SatCatalogoTipo>('metodo');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; text: string } | null>(null);

  const filas: FilaSat[] = tab === 'metodo' ? metodos : formas;

  useEffect(() => {
    if (!abierto) return;
    setEditId(null);
    setForm(FORM_VACIO);
    setMensaje(null);
    void recargar();
  }, [abierto, recargar]);

  if (!abierto) return null;

  const editarFila = (row: FilaSat) => {
    setEditId(row.id);
    setForm({
      clave: row.clave,
      descripcion: row.descripcion,
      orden: String(row.orden),
      activo: row.activo,
      es_default: row.es_default,
    });
    setMensaje(null);
  };

  const nuevaFila = () => {
    setEditId(null);
    const maxOrd = filas.reduce((m, r) => Math.max(m, r.orden), 0);
    setForm({ ...FORM_VACIO, orden: String(maxOrd + 1) });
    setMensaje(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clave.trim() || !form.descripcion.trim()) {
      setMensaje({ tipo: 'err', text: 'Clave y descripción son obligatorias.' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      await guardar(tab, {
        id: editId || undefined,
        clave: form.clave,
        descripcion: form.descripcion,
        orden: Number(form.orden) || 0,
        activo: form.activo,
        es_default: form.es_default,
      });
      setMensaje({ tipo: 'ok', text: editId ? 'Registro actualizado.' : 'Registro creado.' });
      setEditId(null);
      setForm(FORM_VACIO);
    } catch (err) {
      setMensaje({
        tipo: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar.',
      });
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (row: FilaSat) => {
    if (row.id.startsWith('fallback-')) return;
    if (!confirm(`¿Eliminar ${row.clave} — ${row.descripcion}?`)) return;
    setGuardando(true);
    try {
      await eliminar(tab, row.id);
      if (editId === row.id) {
        setEditId(null);
        setForm(FORM_VACIO);
      }
      setMensaje({ tipo: 'ok', text: 'Registro eliminado.' });
    } catch (err) {
      setMensaje({
        tipo: 'err',
        text: err instanceof Error ? err.message : 'No se pudo eliminar (puede estar en uso).',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="modal-catalogos-sat-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-catalogos-sat-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-catalogos-sat-titulo"
      >
        <div className="modal-catalogos-sat-header">
          <h2 id="modal-catalogos-sat-titulo">📚 Catálogos SAT — Pago</h2>
          <button type="button" className="modal-catalogos-sat-cerrar" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="modal-catalogos-sat-tabs">
          <button
            type="button"
            className={tab === 'metodo' ? 'is-active' : ''}
            onClick={() => {
              setTab('metodo');
              setEditId(null);
              setForm(FORM_VACIO);
            }}
          >
            Métodos de pago
          </button>
          <button
            type="button"
            className={tab === 'forma' ? 'is-active' : ''}
            onClick={() => {
              setTab('forma');
              setEditId(null);
              setForm(FORM_VACIO);
            }}
          >
            Formas de pago
          </button>
        </div>

        {(error || mensaje) && (
          <div
            className={`modal-catalogos-sat-alerta${mensaje?.tipo === 'ok' ? ' is-ok' : ''}`}
          >
            {mensaje?.text || error}
          </div>
        )}

        <div className="modal-catalogos-sat-body">
          <div className="modal-catalogos-sat-lista">
            <div className="modal-catalogos-sat-lista-toolbar">
              <strong>{tab === 'metodo' ? 'c_MetodoPago' : 'c_FormaPago'}</strong>
              <button type="button" className="btn-nueva-fila" onClick={nuevaFila} disabled={guardando}>
                ➕ Nuevo
              </button>
            </div>
            {cargando ? (
              <p className="modal-catalogos-sat-vacio">Cargando…</p>
            ) : filas.length === 0 ? (
              <p className="modal-catalogos-sat-vacio">Sin registros. Agrega el primero.</p>
            ) : (
              <div className="modal-catalogos-sat-tabla-wrap">
                <table className="modal-catalogos-sat-tabla">
                  <thead>
                    <tr>
                      <th>Clave</th>
                      <th>Descripción</th>
                      <th>Orden</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((row) => (
                      <tr key={row.id} className={editId === row.id ? 'is-editing' : ''}>
                        <td data-label="Clave">
                          <code>{row.clave}</code>
                          {row.es_default && <span className="badge-default">Default</span>}
                        </td>
                        <td data-label="Descripción">{row.descripcion}</td>
                        <td data-label="Orden">{row.orden}</td>
                        <td data-label="Estado">{row.activo ? 'Activo' : 'Inactivo'}</td>
                        <td data-label="Acciones">
                          <button type="button" onClick={() => editarFila(row)} disabled={guardando}>
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleEliminar(row)}
                            disabled={guardando || row.id.startsWith('fallback-')}
                            title={row.id.startsWith('fallback-') ? 'Aplica la migración SQL primero' : 'Eliminar'}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form className="modal-catalogos-sat-form" onSubmit={(e) => void handleSubmit(e)}>
            <h3>{editId ? 'Editar registro' : 'Nuevo registro'}</h3>
            <label>
              Clave SAT *
              <input
                value={form.clave}
                onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value.toUpperCase() }))}
                placeholder={tab === 'metodo' ? 'PUE' : '01'}
                maxLength={10}
                required
              />
            </label>
            <label>
              Descripción (texto en PDF) *
              <input
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder={tab === 'metodo' ? 'Pago en una sola exhibición' : 'EFECTIVO'}
                required
              />
            </label>
            <label>
              Orden
              <input
                type="number"
                value={form.orden}
                onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
                min={0}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
              Activo en listas de cotización
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.es_default}
                onChange={(e) => setForm((f) => ({ ...f, es_default: e.target.checked }))}
              />
              Valor por defecto al cotizar
            </label>
            {editId && (
              <p className="modal-catalogos-sat-preview">
                Vista en select: <strong>{etiquetaSatPago({ clave: form.clave || '—', descripcion: form.descripcion || '—' })}</strong>
              </p>
            )}
            <div className="modal-catalogos-sat-form-actions">
              <button type="submit" className="btn-guardar" disabled={guardando}>
                {guardando ? 'Guardando…' : '💾 Guardar'}
              </button>
              {editId && (
                <button
                  type="button"
                  className="btn-cancelar"
                  disabled={guardando}
                  onClick={() => {
                    setEditId(null);
                    setForm(FORM_VACIO);
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

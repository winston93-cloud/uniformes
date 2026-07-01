'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  etiquetaSatPago,
  type SatCatalogoTipo,
} from '@/lib/hooks/useSatCatalogosPago';
import type { SatFormaPago, SatMetodoPago } from '@/lib/types';

interface ModalCatalogosSatPagoProps {
  abierto: boolean;
  onClose: () => void;
  metodos: SatMetodoPago[];
  formas: SatFormaPago[];
  cargando: boolean;
  error: string | null;
  guardar: (
    tipo: SatCatalogoTipo,
    payload: Omit<SatMetodoPago, 'id' | 'created_at' | 'updated_at'> & { id?: string }
  ) => Promise<void>;
  eliminar: (tipo: SatCatalogoTipo, id: string) => Promise<void>;
}

type FilaSat = SatMetodoPago | SatFormaPago;

const FORM_VACIO = {
  clave: '',
  descripcion: '',
  orden: '0',
  activo: true,
  es_default: false,
};

function IconEliminar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export default function ModalCatalogosSatPago({
  abierto,
  onClose,
  metodos,
  formas,
  cargando,
  error,
  guardar,
  eliminar,
}: ModalCatalogosSatPagoProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<SatCatalogoTipo>('metodo');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; text: string } | null>(null);

  const filas: FilaSat[] = tab === 'metodo' ? metodos : formas;
  const catalogoNombre = tab === 'metodo' ? 'c_MetodoPago' : 'c_FormaPago';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setEditId(null);
    setForm(FORM_VACIO);
    setMensaje(null);
  }, [abierto]);

  if (!abierto || !mounted) return null;

  const cambiarTab = (nuevo: SatCatalogoTipo) => {
    setTab(nuevo);
    setEditId(null);
    setForm(FORM_VACIO);
    setMensaje(null);
  };

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

  const filaSeleccionada = editId ? filas.find((r) => r.id === editId) : null;

  const handleEliminarSeleccionado = async () => {
    if (!filaSeleccionada) return;
    await handleEliminar(filaSeleccionada);
  };

  const previewPdf =
    form.descripcion.trim() || (editId ? '—' : 'Escribe la descripción que saldrá en el PDF');

  const modal = (
    <div className="modal-catalogos-sat-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-catalogos-sat-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-catalogos-sat-titulo"
      >
        <header className="modal-catalogos-sat-header">
          <div className="modal-catalogos-sat-header-text">
            <span className="modal-catalogos-sat-kicker">Facturación · SAT</span>
            <h2 id="modal-catalogos-sat-titulo">Catálogos de pago</h2>
            <p>Métodos y formas de pago para cotizaciones y PDF</p>
          </div>
          <button type="button" className="modal-catalogos-sat-cerrar" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="modal-catalogos-sat-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'metodo'}
            className={tab === 'metodo' ? 'is-active' : ''}
            onClick={() => cambiarTab('metodo')}
          >
            Métodos de pago
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'forma'}
            className={tab === 'forma' ? 'is-active' : ''}
            onClick={() => cambiarTab('forma')}
          >
            Formas de pago
          </button>
        </div>

        {(error || mensaje) && (
          <div className={`modal-catalogos-sat-alerta${mensaje?.tipo === 'ok' ? ' is-ok' : ''}`}>
            {mensaje?.text || error}
          </div>
        )}

        <div className="modal-catalogos-sat-body">
          <section className="modal-catalogos-sat-lista" aria-label="Registros del catálogo">
            <div className="modal-catalogos-sat-lista-toolbar">
              <div>
                <span className="modal-catalogos-sat-catalogo-tag">{catalogoNombre}</span>
                <span className="modal-catalogos-sat-count">{filas.length} registros</span>
              </div>
            </div>

            {cargando ? (
              <div className="modal-catalogos-sat-vacio">
                <div className="modal-catalogos-sat-spinner" />
                Cargando catálogo…
              </div>
            ) : filas.length === 0 ? (
              <div className="modal-catalogos-sat-vacio">
                Sin registros. Usa «Nuevo registro» del panel derecho.
              </div>
            ) : (
              <ul className="modal-catalogos-sat-cards">
                {filas.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`modal-catalogos-sat-card${editId === row.id ? ' is-editing' : ''}${!row.activo ? ' is-inactive' : ''}`}
                      onClick={() => editarFila(row)}
                      disabled={guardando}
                      aria-current={editId === row.id ? 'true' : undefined}
                    >
                      <span className="modal-catalogos-sat-clave">{row.clave}</span>
                      <div className="modal-catalogos-sat-card-text">
                        <strong>{row.descripcion}</strong>
                        <span>
                          Orden {row.orden} · {row.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {row.es_default && <span className="badge-default">Por defecto</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form className="modal-catalogos-sat-form" onSubmit={(e) => void handleSubmit(e)}>
            <div className="modal-catalogos-sat-form-head">
              <div className="modal-catalogos-sat-form-head-text">
                <h3>{editId ? 'Editar registro' : 'Nuevo registro'}</h3>
                <p>
                  {editId
                    ? 'Modifica los datos y guarda. La descripción es la que sale en el PDF.'
                    : 'Captura un registro nuevo o selecciona uno de la lista.'}
                </p>
              </div>
              <div className="modal-catalogos-sat-form-toolbar acciones-fila">
                {editId && (
                  <button
                    type="button"
                    className="modal-catalogos-sat-toolbar-btn modal-catalogos-sat-toolbar-btn--danger"
                    onClick={() => void handleEliminarSeleccionado()}
                    disabled={guardando || filaSeleccionada?.id.startsWith('fallback-')}
                  >
                    <IconEliminar />
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  className="modal-catalogos-sat-toolbar-btn modal-catalogos-sat-toolbar-btn--primary"
                  onClick={nuevaFila}
                  disabled={guardando}
                >
                  <IconPlus />
                  Nuevo
                </button>
              </div>
            </div>

            <div className="form-group modal-catalogos-sat-field">
              <label className="form-label" htmlFor="sat-clave">
                Clave SAT
              </label>
              <input
                id="sat-clave"
                className="form-input"
                value={form.clave}
                onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value.toUpperCase() }))}
                placeholder={tab === 'metodo' ? 'PUE' : '01'}
                maxLength={10}
                required
                autoComplete="off"
              />
            </div>

            <div className="form-group modal-catalogos-sat-field">
              <label className="form-label" htmlFor="sat-descripcion">
                Descripción (PDF)
              </label>
              <input
                id="sat-descripcion"
                className="form-input"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder={tab === 'metodo' ? 'Pago en una sola exhibición' : 'EFECTIVO'}
                required
                autoComplete="off"
              />
            </div>

            <div className="form-group modal-catalogos-sat-field">
              <label className="form-label" htmlFor="sat-orden">
                Orden en listas
              </label>
              <input
                id="sat-orden"
                className="form-input"
                type="number"
                value={form.orden}
                onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
                min={0}
              />
            </div>

            <div className="modal-catalogos-sat-switches">
              <label className="modal-catalogos-sat-toggle">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <span className="modal-catalogos-sat-toggle-track" aria-hidden />
                <span className="modal-catalogos-sat-toggle-label">Activo en cotizaciones</span>
              </label>
              <label className="modal-catalogos-sat-toggle">
                <input
                  type="checkbox"
                  checked={form.es_default}
                  onChange={(e) => setForm((f) => ({ ...f, es_default: e.target.checked }))}
                />
                <span className="modal-catalogos-sat-toggle-track" aria-hidden />
                <span className="modal-catalogos-sat-toggle-label">Valor por defecto</span>
              </label>
            </div>

            <div className="modal-catalogos-sat-preview-box">
              <span className="modal-catalogos-sat-preview-label">Vista en PDF</span>
              <strong>{previewPdf}</strong>
              {form.clave && form.descripcion && (
                <small>Select: {etiquetaSatPago({ clave: form.clave, descripcion: form.descripcion })}</small>
              )}
            </div>

            <div className="modal-catalogos-sat-form-actions">
              <button type="submit" className="btn-guardar" disabled={guardando}>
                {guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Guardar'}
              </button>
              {(editId || form.clave || form.descripcion) && (
                <button
                  type="button"
                  className="btn-cancelar"
                  disabled={guardando}
                  onClick={() => {
                    setEditId(null);
                    setForm(FORM_VACIO);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

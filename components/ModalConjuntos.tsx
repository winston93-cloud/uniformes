'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Conjunto, Prenda, Talla } from '@/lib/types';
import { useConjuntos } from '@/lib/hooks/useConjuntos';

type PrecioDraft = {
  talla_id: string;
  talla_nombre: string;
  precio: string;
};

type FormState = {
  id?: string;
  nombre: string;
  codigo: string;
  prenda_a_id: string;
  prenda_b_id: string;
  activo: boolean;
  notas: string;
  precios: PrecioDraft[];
};

const formVacio = (tallas: Talla[]): FormState => ({
  nombre: '',
  codigo: '',
  prenda_a_id: '',
  prenda_b_id: '',
  activo: true,
  notas: '',
  precios: [...tallas]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
    .map((t) => ({ talla_id: t.id, talla_nombre: t.nombre, precio: '' })),
});

interface ModalConjuntosProps {
  abierto: boolean;
  onClose: () => void;
  prendas: Prenda[];
  tallas: Talla[];
}

export default function ModalConjuntos({ abierto, onClose, prendas, tallas }: ModalConjuntosProps) {
  const { conjuntos, loading, crearConjunto, actualizarConjunto, eliminarConjunto, fetchConjuntos } =
    useConjuntos();
  const [vista, setVista] = useState<'lista' | 'form'>('lista');
  const [form, setForm] = useState<FormState>(() => formVacio(tallas));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (abierto) {
      void fetchConjuntos();
      setVista('lista');
      setMensaje(null);
      setForm(formVacio(tallas));
    }
  }, [abierto, tallas, fetchConjuntos]);

  const prendasOpts = useMemo(
    () =>
      [...prendas]
        .filter((p) => p.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [prendas]
  );

  if (!abierto) return null;

  const abrirNuevo = () => {
    setForm(formVacio(tallas));
    setVista('form');
    setMensaje(null);
  };

  const abrirEditar = (c: Conjunto) => {
    const base = formVacio(tallas);
    const porTalla = new Map((c.precios ?? []).map((p) => [p.talla_id, p]));
    setForm({
      id: c.id,
      nombre: c.nombre,
      codigo: c.codigo ?? '',
      prenda_a_id: c.prenda_a_id,
      prenda_b_id: c.prenda_b_id,
      activo: c.activo !== false,
      notas: c.notas ?? '',
      precios: base.precios.map((row) => {
        const p = porTalla.get(row.talla_id);
        const v = p ? Number(p.precio_venta || p.precio_menudeo || p.precio_mayoreo || 0) : 0;
        return { ...row, precio: v > 0 ? String(v) : '' };
      }),
    });
    setVista('form');
    setMensaje(null);
  };

  const parsePrecio = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'err', text: 'Escribe el nombre del conjunto.' });
      return;
    }
    if (!form.prenda_a_id || !form.prenda_b_id) {
      setMensaje({ tipo: 'err', text: 'Selecciona las dos prendas del par.' });
      return;
    }
    if (form.prenda_a_id === form.prenda_b_id) {
      setMensaje({ tipo: 'err', text: 'Las dos prendas deben ser distintas.' });
      return;
    }
    const precios = form.precios
      .map((p) => {
        const n = parsePrecio(p.precio);
        return {
          talla_id: p.talla_id,
          precio_mayoreo: n,
          precio_menudeo: n,
          precio_venta: n,
        };
      })
      .filter((p) => p.precio_venta > 0);

    if (precios.length === 0) {
      setMensaje({ tipo: 'err', text: 'Captura al menos un precio de talla (> 0).' });
      return;
    }

    setGuardando(true);
    setMensaje(null);
    try {
      if (form.id) {
        const r = await actualizarConjunto(form.id, {
          nombre: form.nombre,
          codigo: form.codigo || null,
          prenda_a_id: form.prenda_a_id,
          prenda_b_id: form.prenda_b_id,
          activo: form.activo,
          notas: form.notas || null,
          precios,
        });
        if (!r.ok) {
          setMensaje({ tipo: 'err', text: r.error });
          return;
        }
      } else {
        const r = await crearConjunto({
          nombre: form.nombre,
          codigo: form.codigo || null,
          prenda_a_id: form.prenda_a_id,
          prenda_b_id: form.prenda_b_id,
          notas: form.notas || null,
          precios,
        });
        if (!r.ok) {
          setMensaje({ tipo: 'err', text: r.error });
          return;
        }
      }
      setMensaje({ tipo: 'ok', text: 'Conjunto guardado.' });
      setVista('lista');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (c: Conjunto) => {
    if (!confirm(`¿Eliminar el conjunto "${c.nombre}"?`)) return;
    const r = await eliminarConjunto(c.id);
    if (!r.ok) {
      setMensaje({ tipo: 'err', text: r.error });
      return;
    }
    setMensaje({ tipo: 'ok', text: 'Conjunto eliminado.' });
  };

  const nombrePrenda = (id: string) => prendasOpts.find((p) => p.id === id)?.nombre ?? id.slice(0, 8);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: 'min(920px, 100%)',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>🧩 Conjuntos</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Si se venden las 2 prendas en la misma talla, el precio es de conjunto (no la suma).
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem', flex: 1, overflow: 'auto' }}>
          {mensaje ? (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 8,
                background: mensaje.tipo === 'ok' ? '#ecfdf5' : '#fef2f2',
                color: mensaje.tipo === 'ok' ? '#065f46' : '#991b1b',
                fontSize: '0.88rem',
              }}
            >
              {mensaje.text}
            </div>
          ) : null}

          {vista === 'lista' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
                  ➕ Nuevo conjunto
                </button>
              </div>
              {loading ? (
                <p>Cargando…</p>
              ) : conjuntos.length === 0 ? (
                <p style={{ color: '#64748b' }}>Aún no hay conjuntos. Crea el primero.</p>
              ) : (
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Prenda A</th>
                      <th>Prenda B</th>
                      <th>Precios</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {conjuntos.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.nombre}</strong>
                          {c.codigo ? (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.codigo}</div>
                          ) : null}
                        </td>
                        <td>{c.prenda_a?.nombre ?? nombrePrenda(c.prenda_a_id)}</td>
                        <td>{c.prenda_b?.nombre ?? nombrePrenda(c.prenda_b_id)}</td>
                        <td>{(c.precios ?? []).length} talla(s)</td>
                        <td>{c.activo ? 'Activo' : 'Inactivo'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.6rem', marginRight: 6 }}
                            onClick={() => abrirEditar(c)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.35rem 0.6rem' }}
                            onClick={() => void borrar(c)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setVista('lista')}>
                  ← Lista
                </button>
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  className="form-input"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="CONJUNTO PANTS WINSTON"
                />
              </div>
              <div className="form-group">
                <label>Código (opcional)</label>
                <input
                  className="form-input"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="CJ-PANTS-WIN"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Prenda A (pantalón)</label>
                  <select
                    className="form-input"
                    value={form.prenda_a_id}
                    onChange={(e) => setForm({ ...form, prenda_a_id: e.target.value })}
                  >
                    <option value="">Seleccionar…</option>
                    {prendasOpts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Prenda B (chamarra)</label>
                  <select
                    className="form-input"
                    value={form.prenda_b_id}
                    onChange={(e) => setForm({ ...form, prenda_b_id: e.target.value })}
                  >
                    <option value="">Seleccionar…</option>
                    {prendasOpts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {form.id ? (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  />
                  Activo
                </label>
              ) : null}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Precios por talla</div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
                  Vacío o 0 = esa talla no aplica conjunto.
                </p>
                <div
                  style={{
                    maxHeight: 280,
                    overflow: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                  }}
                >
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Talla</th>
                        <th>Precio conjunto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.precios.map((row, i) => (
                        <tr key={row.talla_id}>
                          <td>{row.talla_nombre}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="form-input"
                              value={row.precio}
                              onChange={(e) => {
                                const precios = [...form.precios];
                                precios[i] = { ...row, precio: e.target.value };
                                setForm({ ...form, precios });
                              }}
                              placeholder="0"
                              style={{ maxWidth: 140 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setVista('lista')}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={guardando}
                  onClick={() => void guardar()}
                >
                  {guardando ? 'Guardando…' : '💾 Guardar conjunto'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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

  const preciosConValor = form.precios.filter((p) => parsePrecio(p.precio) > 0).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-conjuntos-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(2px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1180px, 100%)',
          height: 'min(900px, 94vh)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#f8fafc',
          borderRadius: 18,
          boxShadow: '0 28px 60px -18px rgba(15, 23, 42, 0.45)',
          border: '1px solid rgba(148, 163, 184, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: '1.35rem 1.75rem',
            background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.25rem',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              id="modal-conjuntos-titulo"
              style={{ fontWeight: 800, fontSize: '1.45rem', letterSpacing: '-0.02em' }}
            >
              Conjuntos
            </div>
            <p style={{ margin: '0.45rem 0 0', fontSize: '0.95rem', opacity: 0.92, lineHeight: 1.45, maxWidth: 640 }}>
              Cuando se venden las dos prendas en la misma talla, se cobra el precio de conjunto
              (no la suma de cada pieza).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff',
              borderRadius: 10,
              padding: '0.55rem 1rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cerrar
          </button>
        </header>

        <div
          style={{
            padding: '1.35rem 1.75rem 1.75rem',
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {mensaje ? (
            <div
              style={{
                padding: '0.85rem 1.1rem',
                borderRadius: 10,
                background: mensaje.tipo === 'ok' ? '#ecfdf5' : '#fef2f2',
                color: mensaje.tipo === 'ok' ? '#065f46' : '#991b1b',
                border: `1px solid ${mensaje.tipo === 'ok' ? '#a7f3d0' : '#fecaca'}`,
                fontSize: '0.95rem',
                fontWeight: 600,
              }}
            >
              {mensaje.text}
            </div>
          ) : null}

          {vista === 'lista' ? (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
                    {loading ? 'Cargando…' : `${conjuntos.length} conjunto${conjuntos.length === 1 ? '' : 's'}`}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: 2 }}>
                    Define el par de prendas y el precio por talla.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={abrirNuevo}
                  style={{
                    minWidth: 180,
                    padding: '0.7rem 1.15rem',
                    fontSize: '0.95rem',
                    background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                    border: 'none',
                  }}
                >
                  + Nuevo conjunto
                </button>
              </div>

              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Cargando conjuntos…</div>
              ) : conjuntos.length === 0 ? (
                <div
                  style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                  }}
                >
                  Aún no hay conjuntos. Crea el primero para aplicar precios de paquete en pedidos.
                </div>
              ) : (
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ ...thStyle, width: '22%' }}>Nombre</th>
                        <th style={{ ...thStyle, width: '20%' }}>Prenda A</th>
                        <th style={{ ...thStyle, width: '20%' }}>Prenda B</th>
                        <th style={{ ...thStyle, width: '12%', textAlign: 'center' }}>Precios</th>
                        <th style={{ ...thStyle, width: '10%', textAlign: 'center' }}>Estado</th>
                        <th style={{ ...thStyle, width: '16%', textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conjuntos.map((c, idx) => (
                        <tr
                          key={c.id}
                          style={{
                            borderTop: '1px solid #e2e8f0',
                            background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                          }}
                        >
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.98rem' }}>{c.nombre}</div>
                            {c.codigo ? (
                              <div
                                style={{
                                  marginTop: 4,
                                  display: 'inline-block',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#0f766e',
                                  background: '#ccfbf1',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: 6,
                                }}
                              >
                                {c.codigo}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ ...tdStyle, color: '#334155' }}>
                            {c.prenda_a?.nombre ?? nombrePrenda(c.prenda_a_id)}
                          </td>
                          <td style={{ ...tdStyle, color: '#334155' }}>
                            {c.prenda_b?.nombre ?? nombrePrenda(c.prenda_b_id)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                padding: '0.3rem 0.65rem',
                                borderRadius: 999,
                              }}
                            >
                              {(c.precios ?? []).length} talla{(c.precios ?? []).length === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: c.activo ? '#dcfce7' : '#f1f5f9',
                                color: c.activo ? '#166534' : '#64748b',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                padding: '0.3rem 0.7rem',
                                borderRadius: 999,
                              }}
                            >
                              {c.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.45rem 0.85rem', marginRight: 8, fontSize: '0.88rem' }}
                              onClick={() => abrirEditar(c)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem' }}
                              onClick={() => void borrar(c)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', minHeight: 0, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setVista('lista');
                    setMensaje(null);
                  }}
                  style={{ padding: '0.55rem 1rem' }}
                >
                  ← Volver a la lista
                </button>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>
                  {form.id ? 'Editar conjunto' : 'Nuevo conjunto'}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
                  gap: '1.25rem',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <section
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    padding: '1.25rem 1.35rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    alignSelf: 'start',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f766e', letterSpacing: '0.02em' }}>
                    DATOS DEL CONJUNTO
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>Nombre</label>
                    <input
                      className="form-input"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="CONJUNTO PANTS WINSTON"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>Código (opcional)</label>
                    <input
                      className="form-input"
                      value={form.codigo}
                      onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                      placeholder="CJ-PANTS-WIN"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>Prenda A (pantalón)</label>
                    <select
                      className="form-input"
                      value={form.prenda_a_id}
                      onChange={(e) => setForm({ ...form, prenda_a_id: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar…</option>
                      {prendasOpts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={labelStyle}>Prenda B (chamarra)</label>
                    <select
                      className="form-input"
                      value={form.prenda_b_id}
                      onChange={(e) => setForm({ ...form, prenda_b_id: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar…</option>
                      {prendasOpts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.id ? (
                    <label
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.activo}
                        onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                        style={{ width: 18, height: 18 }}
                      />
                      Conjunto activo (aplica en pedidos)
                    </label>
                  ) : null}
                </section>

                <section
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    padding: '1.25rem 1.35rem',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    maxHeight: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '0.75rem',
                      marginBottom: '0.75rem',
                      flexShrink: 0,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f766e', letterSpacing: '0.02em' }}>
                        PRECIOS POR TALLA
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                        Vacío o 0 = esa talla no aplica.
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f766e' }}>
                      {preciosConValor} con precio
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      minHeight: 280,
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1 }}>
                          <th style={{ ...thStyle, width: '40%' }}>Talla</th>
                          <th style={{ ...thStyle, width: '60%' }}>Precio conjunto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.precios.map((row, i) => (
                          <tr key={row.talla_id} style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ ...tdStyle, fontWeight: 700 }}>{row.talla_nombre}</td>
                            <td style={tdStyle}>
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
                                style={{ ...inputStyle, maxWidth: 180 }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  paddingTop: '0.25rem',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setVista('lista');
                    setMensaje(null);
                  }}
                  style={{ padding: '0.7rem 1.25rem', minWidth: 120 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={guardando}
                  onClick={() => void guardar()}
                  style={{
                    padding: '0.7rem 1.35rem',
                    minWidth: 200,
                    background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                    border: 'none',
                    fontSize: '0.95rem',
                  }}
                >
                  {guardando ? 'Guardando…' : 'Guardar conjunto'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: '0.9rem 1.1rem',
  textAlign: 'left',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#475569',
};

const tdStyle: CSSProperties = {
  padding: '1rem 1.1rem',
  fontSize: '0.95rem',
  verticalAlign: 'middle',
  wordBreak: 'break-word',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '0.35rem',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.7rem 0.85rem',
  fontSize: '0.95rem',
  borderRadius: 10,
};

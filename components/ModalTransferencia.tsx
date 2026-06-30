'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { normalizarCamposCostoApi } from '@/lib/costoQueries';

interface ModalTransferenciaProps {
  onClose: () => void;
}

type SucursalOption = { id: string; nombre: string; es_matriz?: boolean };

type CostoDisponible = {
  costo_id: string;
  prenda_id: string;
  prenda_nombre: string;
  prenda_codigo: string;
  talla_id: string;
  talla_nombre: string;
  stock: number;
};

type LineaForm = {
  tempId: string;
  costo_id: string;
  prenda_id: string;
  talla_id: string;
  cantidad: string;
  stock_max: number;
  label: string;
};

function destinoAutomatico(origenId: string, sucursales: SucursalOption[]): string {
  if (!origenId || sucursales.length < 2) return '';
  const otra = sucursales.find((s) => s.id !== origenId);
  return otra?.id ?? '';
}

export default function ModalTransferencia({ onClose }: ModalTransferenciaProps) {
  const { sesion } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cargandoCostos, setCargandoCostos] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sucursales, setSucursales] = useState<SucursalOption[]>([]);
  const [sucursalOrigenId, setSucursalOrigenId] = useState('');
  const [costosDisponibles, setCostosDisponibles] = useState<CostoDisponible[]>([]);

  const [observaciones, setObservaciones] = useState('');
  const [costoSeleccionado, setCostoSeleccionado] = useState('');
  const [cantidadNueva, setCantidadNueva] = useState('');
  const [detalles, setDetalles] = useState<LineaForm[]>([]);

  const sucursalDestinoId = useMemo(
    () => destinoAutomatico(sucursalOrigenId, sucursales),
    [sucursalOrigenId, sucursales]
  );

  const sucursalOrigen = sucursales.find((s) => s.id === sucursalOrigenId);
  const sucursalDestino = sucursales.find((s) => s.id === sucursalDestinoId);

  const puedeEnviarDesdeOrigen = Boolean(
    sesion?.sucursal_id && sucursalOrigenId && sucursalOrigenId === sesion.sucursal_id
  );

  const cargarInventarioOrigen = useCallback(async (origenId: string) => {
    if (!origenId) {
      setCostosDisponibles([]);
      setCargandoCostos(false);
      return;
    }

    setCargandoCostos(true);
    try {
      const { data: costosRaw, error: errCostos } = await insforgeDb().from('costos').select('*');
      if (errCostos) throw errCostos;

      const oid = origenId.trim().toLowerCase();
      const costosOrigen = (costosRaw || [])
        .map((r) => normalizarCamposCostoApi(r as Record<string, unknown>))
        .filter((c) => {
          const cs = String(c.sucursal_id ?? '').trim().toLowerCase();
          return cs === oid && Number(c.stock ?? 0) > 0;
        });

      const prendaIds = [...new Set(costosOrigen.map((c) => String(c.prenda_id)).filter(Boolean))];
      const tallaIds = [...new Set(costosOrigen.map((c) => String(c.talla_id)).filter(Boolean))];

      const [preRes, taRes] = await Promise.all([
        prendaIds.length
          ? insforgeDb().from('prendas').select('id, nombre, codigo').in('id', prendaIds)
          : Promise.resolve({ data: [] }),
        tallaIds.length
          ? insforgeDb().from('tallas').select('id, nombre').in('id', tallaIds)
          : Promise.resolve({ data: [] }),
      ]);

      const preMap = new Map(
        (preRes.data || []).map((p) => {
          const r = p as { id: string; nombre?: string; codigo?: string | null };
          return [String(r.id).toLowerCase(), r] as const;
        })
      );
      const taMap = new Map(
        (taRes.data || []).map((t) => {
          const r = t as { id: string; nombre?: string };
          return [String(r.id).toLowerCase(), r] as const;
        })
      );

      const lista: CostoDisponible[] = costosOrigen.map((c) => {
        const pid = String(c.prenda_id ?? '');
        const tid = String(c.talla_id ?? '');
        const pre = preMap.get(pid.toLowerCase());
        const ta = taMap.get(tid.toLowerCase());
        return {
          costo_id: String(c.id),
          prenda_id: pid,
          prenda_nombre: pre?.nombre ?? 'Prenda',
          prenda_codigo: pre?.codigo ?? '',
          talla_id: tid,
          talla_nombre: ta?.nombre ?? 'Talla',
          stock: Number(c.stock ?? 0),
        };
      });

      lista.sort((a, b) =>
        `${a.prenda_nombre} ${a.talla_nombre}`.localeCompare(`${b.prenda_nombre} ${b.talla_nombre}`, 'es')
      );
      setCostosDisponibles(lista);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el inventario del origen seleccionado.');
      setCostosDisponibles([]);
    } finally {
      setCargandoCostos(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      try {
        const { data: sucursalesData } = await insforgeDb()
          .from('sucursales')
          .select('id, nombre, es_matriz')
          .eq('activo', true)
          .order('es_matriz', { ascending: false });

        const lista = (sucursalesData || []) as SucursalOption[];
        setSucursales(lista);

        const origenInicial =
          sesion?.sucursal_id && lista.some((s) => s.id === sesion.sucursal_id)
            ? sesion.sucursal_id
            : lista[0]?.id ?? '';
        setSucursalOrigenId(origenInicial);
      } catch (err) {
        console.error(err);
        setError('No se pudieron cargar las sucursales.');
      }
    };
    void init();
  }, [sesion?.sucursal_id]);

  useEffect(() => {
    if (!sucursalOrigenId) return;
    setDetalles([]);
    setCostoSeleccionado('');
    setCantidadNueva('');
    void cargarInventarioOrigen(sucursalOrigenId);
  }, [sucursalOrigenId, cargarInventarioOrigen]);

  const costosFiltradosSelect = useMemo(() => {
    const usados = new Set(detalles.map((d) => d.costo_id));
    return costosDisponibles.filter((c) => !usados.has(c.costo_id));
  }, [costosDisponibles, detalles]);

  const agregarLinea = () => {
    if (!puedeEnviarDesdeOrigen) {
      setError(`Solo puedes enviar desde tu tienda (${sesion?.sucursal_nombre}).`);
      return;
    }

    const costo = costosDisponibles.find((c) => c.costo_id === costoSeleccionado);
    if (!costo) {
      setError('Selecciona una prenda/talla con stock.');
      return;
    }
    const qty = Math.trunc(Number(cantidadNueva));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Indica una cantidad válida.');
      return;
    }
    if (qty > costo.stock) {
      setError(`Stock insuficiente: hay ${costo.stock} disponibles.`);
      return;
    }

    setDetalles((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        costo_id: costo.costo_id,
        prenda_id: costo.prenda_id,
        talla_id: costo.talla_id,
        cantidad: String(qty),
        stock_max: costo.stock,
        label: `${costo.prenda_nombre} — Talla ${costo.talla_nombre}`,
      },
    ]);
    setCostoSeleccionado('');
    setCantidadNueva('');
    setError(null);
  };

  const quitarLinea = (tempId: string) => {
    setDetalles((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!puedeEnviarDesdeOrigen) {
        setError(`Solo puedes enviar mercancía desde ${sesion?.sucursal_nombre}.`);
        setLoading(false);
        return;
      }
      if (!sucursalDestinoId) {
        setError('Selecciona un origen válido (matriz o sucursal).');
        setLoading(false);
        return;
      }
      if (detalles.length === 0) {
        setError('Agrega al menos una prenda a la transferencia.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/transferencias/crear', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursal_origen_id: sucursalOrigenId,
          sucursal_destino_id: sucursalDestinoId,
          observaciones,
          detalles: detalles.map((d) => ({
            prenda_id: d.prenda_id,
            talla_id: d.talla_id,
            cantidad: Math.trunc(Number(d.cantidad)),
            costo_id: d.costo_id,
          })),
        }),
      });

      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? 'No se pudo crear la transferencia.');
      }

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
        style={{ maxWidth: '860px', maxHeight: '92vh', overflowY: 'auto' }}
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
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  color: '#991b1b',
                }}
              >
                ❌ {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Origen <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                className="form-input"
                value={sucursalOrigenId}
                onChange={(e) => setSucursalOrigenId(e.target.value)}
                required
              >
                <option value="">Selecciona origen…</option>
                {sucursales.map((suc) => (
                  <option key={suc.id} value={suc.id}>
                    {suc.es_matriz ? '🏛️' : '📍'} {suc.nombre}
                  </option>
                ))}
              </select>
              <small style={{ color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                Al enviar se descuenta el stock del origen. Solo puedes enviar desde{' '}
                <strong>{sesion?.sucursal_nombre}</strong>.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Destino</label>
              <div
                className="form-input"
                style={{
                  background: '#f8fafc',
                  color: '#334155',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: '2.75rem',
                }}
              >
                {sucursalDestino ? (
                  <>
                    {sucursalDestino.es_matriz ? '🏛️' : '📍'} {sucursalDestino.nombre}
                  </>
                ) : (
                  <span style={{ color: '#94a3b8', fontWeight: 400 }}>Se asigna al elegir el origen</span>
                )}
              </div>
            </div>

            {!puedeEnviarDesdeOrigen && sucursalOrigenId && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1rem',
                  color: '#92400e',
                  fontSize: '0.92rem',
                }}
              >
                El origen seleccionado no es tu tienda. Cambia el origen a{' '}
                <strong>{sesion?.sucursal_nombre}</strong> para armar y enviar la transferencia.
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-input"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
                Prendas a transferir
                {sucursalOrigen ? (
                  <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.95rem' }}>
                    {' '}
                    — inventario de {sucursalOrigen.nombre}
                  </span>
                ) : null}
              </h3>

              {!sucursalOrigenId ? (
                <p style={{ color: '#64748b' }}>Elige el origen para ver el inventario disponible.</p>
              ) : cargandoCostos ? (
                <p style={{ color: '#64748b' }}>Cargando inventario…</p>
              ) : costosDisponibles.length === 0 ? (
                <p style={{ color: '#64748b' }}>No hay stock en {sucursalOrigen?.nombre ?? 'esta tienda'} para transferir.</p>
              ) : puedeEnviarDesdeOrigen ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <select
                    className="form-input"
                    style={{ flex: '2 1 240px' }}
                    value={costoSeleccionado}
                    onChange={(e) => setCostoSeleccionado(e.target.value)}
                  >
                    <option value="">Prenda / talla…</option>
                    {costosFiltradosSelect.map((c) => (
                      <option key={c.costo_id} value={c.costo_id}>
                        {c.prenda_nombre} — Talla {c.talla_nombre} (disp. {c.stock})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="form-input"
                    style={{ flex: '0 1 120px' }}
                    placeholder="Cant."
                    value={cantidadNueva}
                    onChange={(e) => setCantidadNueva(e.target.value)}
                  />
                  <button type="button" className="btn btn-secondary" onClick={agregarLinea}>
                    ➕ Agregar
                  </button>
                </div>
              ) : null}

              {detalles.length > 0 && (
                <table className="table" style={{ marginTop: '0.5rem' }}>
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Cantidad</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((d) => (
                      <tr key={d.tempId}>
                        <td>{d.label}</td>
                        <td>{d.cantidad}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.35rem 0.75rem' }}
                            onClick={() => quitarLinea(d.tempId)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                loading ||
                !sucursalOrigenId ||
                !sucursalDestinoId ||
                !puedeEnviarDesdeOrigen ||
                detalles.length === 0
              }
            >
              {loading ? '⏳ Enviando…' : '🚚 Enviar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

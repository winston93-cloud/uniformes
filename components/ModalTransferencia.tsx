'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { insforgeDb } from '@/lib/insforgeBrowser';
import SelectorPrendasTransferencia, {
  type LineaTransferenciaSeleccionada,
} from '@/components/transferencias/SelectorPrendasTransferencia';
import type { Transferencia } from '@/lib/types';

interface ModalTransferenciaProps {
  onClose: () => void;
  /** Si viene, el modal edita una transferencia en tránsito. */
  transferenciaEditar?: Transferencia | null;
}

type SucursalOption = { id: string; nombre: string; es_matriz?: boolean };

function destinoAutomatico(origenId: string, sucursales: SucursalOption[]): string {
  if (!origenId || sucursales.length < 2) return '';
  const otra = sucursales.find((s) => s.id !== origenId);
  return otra?.id ?? '';
}

export default function ModalTransferencia({ onClose, transferenciaEditar }: ModalTransferenciaProps) {
  const { sesion } = useAuth();
  const esEdicion = Boolean(transferenciaEditar?.id);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(esEdicion);
  const [error, setError] = useState<string | null>(null);

  const [sucursales, setSucursales] = useState<SucursalOption[]>([]);
  const [sucursalOrigenId, setSucursalOrigenId] = useState('');
  const [sucursalDestinoFijoId, setSucursalDestinoFijoId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaTransferenciaSeleccionada[]>([]);
  const [cantidadesIniciales, setCantidadesIniciales] = useState<Record<string, number>>({});
  const [detalleListo, setDetalleListo] = useState(!esEdicion);

  const handleSeleccionChange = useCallback((nuevas: LineaTransferenciaSeleccionada[]) => {
    setLineas(nuevas);
  }, []);

  const sucursalDestinoId = useMemo(() => {
    if (esEdicion && sucursalDestinoFijoId) return sucursalDestinoFijoId;
    return destinoAutomatico(sucursalOrigenId, sucursales);
  }, [esEdicion, sucursalDestinoFijoId, sucursalOrigenId, sucursales]);

  const sucursalOrigen = sucursales.find((s) => s.id === sucursalOrigenId);
  const sucursalDestino = sucursales.find((s) => s.id === sucursalDestinoId);

  const puedeEnviarDesdeOrigen = Boolean(
    sesion?.sucursal_id && sucursalOrigenId && sucursalOrigenId === sesion.sucursal_id
  );

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

        if (transferenciaEditar) {
          setSucursalOrigenId(String(transferenciaEditar.sucursal_origen_id));
          setSucursalDestinoFijoId(String(transferenciaEditar.sucursal_destino_id));
          setObservaciones(transferenciaEditar.observaciones ?? '');

          setCargandoDetalle(true);
          const { data: filas, error: errDet } = await insforgeDb()
            .from('detalle_transferencias')
            .select('costo_id, cantidad')
            .eq('transferencia_id', transferenciaEditar.id);
          if (errDet) throw errDet;

          const iniciales: Record<string, number> = {};
          for (const f of filas || []) {
            const cid = f.costo_id ? String(f.costo_id) : '';
            const qty = Math.trunc(Number(f.cantidad ?? 0));
            if (cid && qty > 0) iniciales[cid] = (iniciales[cid] ?? 0) + qty;
          }
          setCantidadesIniciales(iniciales);
          setDetalleListo(true);
        } else {
          const origenInicial =
            sesion?.sucursal_id && lista.some((s) => s.id === sesion.sucursal_id)
              ? sesion.sucursal_id
              : lista[0]?.id ?? '';
          setSucursalOrigenId(origenInicial);
          setDetalleListo(true);
        }
      } catch (err) {
        console.error(err);
        setError(
          esEdicion
            ? 'No se pudo cargar la transferencia a modificar.'
            : 'No se pudieron cargar las sucursales.'
        );
        setDetalleListo(true);
      } finally {
        setCargandoDetalle(false);
      }
    };
    void init();
  }, [sesion?.sucursal_id, transferenciaEditar, esEdicion]);

  useEffect(() => {
    if (!esEdicion) setLineas([]);
  }, [sucursalOrigenId, esEdicion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!puedeEnviarDesdeOrigen) {
        setError(`Solo puedes ${esEdicion ? 'modificar' : 'enviar'} mercancía desde ${sesion?.sucursal_nombre}.`);
        setLoading(false);
        return;
      }
      if (!sucursalDestinoId) {
        setError('Selecciona un origen válido (matriz o sucursal).');
        setLoading(false);
        return;
      }
      if (lineas.length === 0) {
        setError('Selecciona al menos una talla con cantidad a transferir.');
        setLoading(false);
        return;
      }

      const payloadDetalles = lineas.map((d) => ({
        prenda_id: d.prenda_id,
        talla_id: d.talla_id,
        cantidad: d.cantidad,
        costo_id: d.costo_id,
      }));

      const res = await fetch(
        esEdicion ? '/api/transferencias/modificar' : '/api/transferencias/crear',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            esEdicion
              ? {
                  transferencia_id: transferenciaEditar!.id,
                  observaciones,
                  detalles: payloadDetalles,
                }
              : {
                  sucursal_origen_id: sucursalOrigenId,
                  sucursal_destino_id: sucursalDestinoId,
                  observaciones,
                  detalles: payloadDetalles,
                }
          ),
        }
      );

      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(
          json.message ?? (esEdicion ? 'No se pudo modificar la transferencia.' : 'No se pudo crear la transferencia.')
        );
      }

      onClose();
    } catch (err) {
      console.error(esEdicion ? 'Error modificando transferencia:' : 'Error creando transferencia:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ maxWidth: '980px', width: 'min(96vw, 980px)', maxHeight: '94vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>
            {esEdicion
              ? `✏️ Modificar transferencia ${transferenciaEditar?.folio ?? ''}`
              : '🚚 Nueva Transferencia de Mercancía'}
          </h2>
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

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Origen <span style={{ color: 'red' }}>*</span>
                </label>
                {esEdicion ? (
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
                    {sucursalOrigen ? (
                      <>
                        {sucursalOrigen.es_matriz ? '🏛️' : '📍'} {sucursalOrigen.nombre}
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                ) : (
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
                )}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
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
                    <span style={{ color: '#94a3b8', fontWeight: 400 }}>Se asigna al elegir origen</span>
                  )}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 1rem' }}>
              {esEdicion ? (
                <>
                  Al guardar se ajusta el stock del origen según las nuevas cantidades. Solo puedes modificar desde{' '}
                  <strong>{sesion?.sucursal_nombre}</strong>.
                </>
              ) : (
                <>
                  Al enviar se descuenta stock del origen. Solo puedes enviar desde{' '}
                  <strong>{sesion?.sucursal_nombre}</strong>.
                </>
              )}
            </p>

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
                Cambia el origen a <strong>{sesion?.sucursal_nombre}</strong> para seleccionar prendas y{' '}
                {esEdicion ? 'guardar' : 'enviar'}.
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

            <div
              style={{
                borderTop: '2px solid #f1f5f9',
                paddingTop: '1.25rem',
                marginTop: '0.5rem',
              }}
            >
              <h3 style={{ marginBottom: '1rem', fontSize: '1.15rem', color: '#1e293b' }}>
                📦 Selección de prendas
                {sucursalOrigen ? (
                  <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.92rem' }}>
                    {' '}
                    — inventario {sucursalOrigen.nombre}
                    {sucursalDestino ? ` → ${sucursalDestino.nombre}` : ''}
                  </span>
                ) : null}
              </h3>

              {cargandoDetalle || !detalleListo ? (
                <p style={{ color: '#64748b' }}>Cargando partidas…</p>
              ) : (
                <SelectorPrendasTransferencia
                  origenId={sucursalOrigenId}
                  origenNombre={sucursalOrigen?.nombre}
                  habilitado={puedeEnviarDesdeOrigen}
                  onSeleccionChange={handleSeleccionChange}
                  cantidadesIniciales={esEdicion ? cantidadesIniciales : undefined}
                />
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
                cargandoDetalle ||
                !sucursalOrigenId ||
                !sucursalDestinoId ||
                !puedeEnviarDesdeOrigen ||
                lineas.length === 0
              }
            >
              {loading
                ? esEdicion
                  ? '⏳ Guardando…'
                  : '⏳ Enviando…'
                : esEdicion
                  ? lineas.length > 0
                    ? `💾 Guardar cambios (${lineas.reduce((s, l) => s + l.cantidad, 0)} piezas)`
                    : '💾 Guardar cambios'
                  : lineas.length > 0
                    ? `🚚 Enviar ${lineas.reduce((s, l) => s + l.cantidad, 0)} piezas`
                    : '🚚 Enviar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

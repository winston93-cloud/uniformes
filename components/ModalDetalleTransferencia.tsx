'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { insforgeDb } from '@/lib/insforgeBrowser';
import type { Transferencia } from '@/lib/types';
import ModalReenviarComplementario, {
  type PartidaComplementaria,
} from '@/components/ModalReenviarComplementario';

interface ModalDetalleTransferenciaProps {
  transferencia: Transferencia;
  onClose: () => void;
  onRecibida?: () => void;
}

type DetalleRow = {
  id: string;
  cantidad: number;
  prenda_id: string;
  talla_id: string;
  costo_id: string;
  prenda_nombre: string;
  talla_nombre: string;
  estado: string;
};

function labelEstadoDetalle(estado: string) {
  const e = estado.toUpperCase();
  if (e === 'RECIBIDA') return { text: 'Recibida', color: '#065f46' };
  if (e === 'EN_TRANSITO_COMPLEMENTARIO') return { text: 'Tránsito complementario', color: '#dc2626' };
  if (e === 'EN_TRANSITO' || e === 'PENDIENTE') return { text: 'En tránsito', color: '#1d4ed8' };
  return { text: e.charAt(0) + e.slice(1).toLowerCase().replace(/_/g, ' '), color: '#64748b' };
}

function labelEstadoCabecera(estado: string) {
  if (estado === 'RECIBIDA_PARCIAL') return 'RECIBIDO PARCIAL';
  return estado;
}

export default function ModalDetalleTransferencia({
  transferencia,
  onClose,
  onRecibida,
}: ModalDetalleTransferenciaProps) {
  const { sesion } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [detalles, setDetalles] = useState<DetalleRow[]>([]);
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [recibiendo, setRecibiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partidaReenviar, setPartidaReenviar] = useState<PartidaComplementaria | null>(null);
  const [estadoLocal, setEstadoLocal] = useState(transferencia.estado);
  const [recibiendoPartidaId, setRecibiendoPartidaId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const esOrigen = String(transferencia.sucursal_origen_id) === sesion?.sucursal_id;
  const esDestino = String(transferencia.sucursal_destino_id) === sesion?.sucursal_id;

  const puedeCancelar =
    esOrigen &&
    (estadoLocal === 'EN_TRANSITO' ||
      estadoLocal === 'PENDIENTE' ||
      estadoLocal === 'RECIBIDA_PARCIAL');

  const pendientesRecibir = useMemo(
    () =>
      detalles.filter((d) => {
        const e = d.estado.toUpperCase();
        return e === 'EN_TRANSITO' || e === 'PENDIENTE';
      }),
    [detalles]
  );

  const puedeRecibir =
    esDestino &&
    pendientesRecibir.length > 0 &&
    (estadoLocal === 'EN_TRANSITO' ||
      estadoLocal === 'PENDIENTE' ||
      estadoLocal === 'RECIBIDA_PARCIAL');

  const mostrarChecks = puedeRecibir;

  useEffect(() => {
    setMounted(true);
    setEstadoLocal(transferencia.estado);
    void cargarDetalle();
  }, [transferencia.id, transferencia.estado]);

  const cargarDetalle = async () => {
    setLoading(true);
    try {
      let { data: filas, error: err } = await insforgeDb()
        .from('detalle_transferencias')
        .select('id, cantidad, prenda_id, talla_id, costo_id, estado')
        .eq('transferencia_id', transferencia.id);

      if (err && String(err.message || '').toLowerCase().includes('estado')) {
        const fb = await insforgeDb()
          .from('detalle_transferencias')
          .select('id, cantidad, prenda_id, talla_id, costo_id')
          .eq('transferencia_id', transferencia.id);
        filas = (fb.data || []).map((f) => ({ ...f, estado: 'EN_TRANSITO' }));
        err = fb.error;
      }

      if (err) throw err;

      const prendaIds = [...new Set((filas || []).map((f) => String(f.prenda_id)).filter(Boolean))];
      const tallaIds = [...new Set((filas || []).map((f) => String(f.talla_id)).filter(Boolean))];

      const [preRes, taRes] = await Promise.all([
        prendaIds.length
          ? insforgeDb().from('prendas').select('id, nombre').in('id', prendaIds)
          : Promise.resolve({ data: [] }),
        tallaIds.length
          ? insforgeDb().from('tallas').select('id, nombre').in('id', tallaIds)
          : Promise.resolve({ data: [] }),
      ]);

      const preMap = new Map(
        (preRes.data || []).map((p) => [String((p as { id: string }).id).toLowerCase(), (p as { nombre?: string }).nombre ?? ''])
      );
      const taMap = new Map(
        (taRes.data || []).map((t) => [String((t as { id: string }).id).toLowerCase(), (t as { nombre?: string }).nombre ?? ''])
      );

      const rows: DetalleRow[] = (filas || []).map((f) => ({
        id: String(f.id),
        cantidad: Number(f.cantidad ?? 0),
        prenda_id: String(f.prenda_id ?? ''),
        talla_id: String(f.talla_id ?? ''),
        costo_id: f.costo_id ? String(f.costo_id) : '',
        prenda_nombre: preMap.get(String(f.prenda_id).toLowerCase()) ?? 'Prenda',
        talla_nombre: taMap.get(String(f.talla_id).toLowerCase()) ?? 'Talla',
        estado: String(f.estado ?? 'EN_TRANSITO'),
      }));

      setDetalles(rows);

      const checks: Record<string, boolean> = {};
      for (const r of rows) {
        const est = r.estado.toUpperCase();
        checks[r.id] = est === 'EN_TRANSITO' || est === 'PENDIENTE';
      }
      setSeleccionados(checks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle.');
    } finally {
      setLoading(false);
    }
  };

  const idsMarcados = useMemo(
    () => pendientesRecibir.filter((d) => seleccionados[d.id]).map((d) => d.id),
    [pendientesRecibir, seleccionados]
  );

  const todosMarcados =
    pendientesRecibir.length > 0 && idsMarcados.length === pendientesRecibir.length;
  const ningunoMarcado = idsMarcados.length === 0;

  const toggleUno = (id: string) => {
    setSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTodos = () => {
    const next = !todosMarcados;
    const checks = { ...seleccionados };
    for (const d of pendientesRecibir) checks[d.id] = next;
    setSeleccionados(checks);
  };

  const hayComplementarias = useMemo(
    () => detalles.some((d) => d.estado.toUpperCase() === 'EN_TRANSITO_COMPLEMENTARIO'),
    [detalles]
  );

  const hayPendientesTrasParcial =
    estadoLocal === 'RECIBIDA_PARCIAL' &&
    detalles.some((d) => {
      const e = d.estado.toUpperCase();
      return e === 'EN_TRANSITO' || e === 'PENDIENTE' || e === 'EN_TRANSITO_COMPLEMENTARIO';
    });

  const mostrarColAcciones = esOrigen || (esDestino && (hayComplementarias || hayPendientesTrasParcial));

  const handleRecibirPartidaComplementaria = async (detalleId: string) => {
    setRecibiendoPartidaId(detalleId);
    setError(null);
    try {
      const res = await fetch('/api/transferencias/recibir-partida', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferencia_id: transferencia.id,
          detalle_id: detalleId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; estado?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? 'No se pudo recibir la partida.');
      }
      if (json.estado) setEstadoLocal(json.estado as Transferencia['estado']);
      await cargarDetalle();
      onRecibida?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recibir la partida.');
    } finally {
      setRecibiendoPartidaId(null);
    }
  };

  const handleRecibir = async () => {
    if (ningunoMarcado) {
      setError('Selecciona al menos una prenda para recibir.');
      return;
    }
    setRecibiendo(true);
    setError(null);
    try {
      const res = await fetch('/api/transferencias/recibir', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferencia_id: transferencia.id,
          detalle_ids: idsMarcados,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; estado?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? 'No se pudo recibir la transferencia.');
      }
      onRecibida?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recibir.');
    } finally {
      setRecibiendo(false);
    }
  };

  const trasReenvio = async () => {
    await cargarDetalle();
    // Refrescar cabecera desde BD
    const { data } = await insforgeDb()
      .from('transferencias')
      .select('estado')
      .eq('id', transferencia.id)
      .maybeSingle();
    if (data?.estado) {
      setEstadoLocal(String(data.estado) as Transferencia['estado']);
    }
    onRecibida?.();
  };

  const handleCancelar = async () => {
    const ok = confirm(
      `¿Cancelar ${transferencia.folio}?\n\nLas partidas en tránsito regresarán al inventario de origen.`
    );
    if (!ok) return;
    setCancelando(true);
    setError(null);
    try {
      const res = await fetch('/api/transferencias/cancelar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferencia_id: transferencia.id }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? 'No se pudo cancelar.');
      setEstadoLocal('CANCELADA');
      onRecibida?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar.');
    } finally {
      setCancelando(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '860px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 Transferencia {transferencia.folio}</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <p>
            <strong>Estado:</strong>{' '}
            <span
              style={{
                fontWeight: 700,
                color: estadoLocal === 'RECIBIDA_PARCIAL' ? '#c2410c' : undefined,
              }}
            >
              {labelEstadoCabecera(estadoLocal)}
            </span>
          </p>
          <p>
            <strong>Origen:</strong> {transferencia.sucursal_origen?.nombre ?? '—'} →{' '}
            <strong>Destino:</strong> {transferencia.sucursal_destino?.nombre ?? '—'}
          </p>
          {transferencia.observaciones && (
            <p style={{ color: '#64748b' }}>
              <strong>Notas:</strong> {transferencia.observaciones}
            </p>
          )}

          <h3 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>Detalle</h3>
          {mostrarChecks && (
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Desmarca las prendas que <strong>no</strong> recibiste: quedarán en rojo. El origen podrá corregirlas y
              reenviarlas.
            </p>
          )}
          {esDestino && hayComplementarias && (
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '0.75rem' }}>
              En las partidas en rojo usa <strong>✅ Recibir</strong> para sumarlas a tu stock (reenvío o cambio desde
              origen). Cuando todas estén recibidas, la transferencia queda <strong>RECIBIDA</strong>.
            </p>
          )}
          {esOrigen && estadoLocal === 'RECIBIDA_PARCIAL' && (
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Las partidas en rojo se pueden <strong>modificar / reenviar</strong>. Al reenviar vuelven a tránsito para
              que el destino las reciba.
            </p>
          )}
          {loading ? (
            <p>Cargando…</p>
          ) : detalles.length === 0 ? (
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                color: '#9a3412',
                padding: '0.85rem 1rem',
                borderRadius: 8,
              }}
            >
              <strong>Sin partidas.</strong> Esta transferencia quedó sin detalle (error al guardarla).
              {esOrigen ? (
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                    onClick={async () => {
                      setError(null);
                      try {
                        const res = await fetch('/api/transferencias/limpiar-sin-partidas', {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ transferencia_id: transferencia.id }),
                        });
                        const json = (await res.json()) as { ok?: boolean; message?: string };
                        if (!res.ok || !json.ok) throw new Error(json.message ?? 'No se pudo cancelar.');
                        onRecibida?.();
                        onClose();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Error al cancelar.');
                      }
                    }}
                  >
                    Cancelar esta transferencia vacía
                  </button>
                </div>
              ) : (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.88rem' }}>
                  Pide a la sucursal origen que la cancele y cree una nueva.
                </p>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <table className="table" style={{ margin: 0, minWidth: 640 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {mostrarChecks && (
                      <th style={{ width: 48, padding: '0.85rem 0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={todosMarcados}
                          onChange={toggleTodos}
                          aria-label="Seleccionar todas"
                        />
                      </th>
                    )}
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569' }}>
                      Prenda
                    </th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569', textAlign: 'center', width: 110 }}>
                      Talla
                    </th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569', textAlign: 'center', width: 130 }}>
                      Cantidad
                    </th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569', textAlign: 'center', width: 160 }}>
                      Estatus
                    </th>
                    {mostrarColAcciones && (
                      <th style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#475569' }}>
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d) => {
                    const est = d.estado.toUpperCase();
                    const esComplementario = est === 'EN_TRANSITO_COMPLEMENTARIO';
                    const esPendiente = est === 'EN_TRANSITO' || est === 'PENDIENTE';
                    const marcado = Boolean(seleccionados[d.id]);
                    const lab = labelEstadoDetalle(d.estado);
                    const piezasLabel = d.cantidad === 1 ? 'pieza' : 'piezas';
                    return (
                      <tr
                        key={d.id}
                        style={{
                          background: esComplementario
                            ? '#fef2f2'
                            : mostrarChecks && esPendiente && !marcado
                              ? '#f8fafc'
                              : '#fff',
                          opacity: mostrarChecks && esPendiente && !marcado ? 0.72 : 1,
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        {mostrarChecks && (
                          <td style={{ padding: '1rem 0.75rem', verticalAlign: 'middle' }}>
                            {esPendiente ? (
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => toggleUno(d.id)}
                                aria-label={`Recibir ${d.prenda_nombre} talla ${d.talla_nombre}`}
                              />
                            ) : (
                              <span aria-hidden style={{ color: '#94a3b8' }}>
                                —
                              </span>
                            )}
                          </td>
                        )}
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '1rem',
                              color: esComplementario ? '#b91c1c' : '#0f172a',
                              lineHeight: 1.3,
                            }}
                          >
                            {d.prenda_nombre}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 4,
                              minWidth: 72,
                              padding: '0.45rem 0.7rem',
                              borderRadius: 10,
                              background: esComplementario ? '#fee2e2' : '#eff6ff',
                              border: `1px solid ${esComplementario ? '#fecaca' : '#bfdbfe'}`,
                            }}
                          >
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              Talla
                            </span>
                            <span
                              style={{
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: esComplementario ? '#b91c1c' : '#1d4ed8',
                                lineHeight: 1,
                              }}
                            >
                              {d.talla_nombre}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 4,
                              minWidth: 88,
                              padding: '0.45rem 0.7rem',
                              borderRadius: 10,
                              background: esComplementario ? '#fee2e2' : '#ecfdf5',
                              border: `1px solid ${esComplementario ? '#fecaca' : '#a7f3d0'}`,
                            }}
                          >
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              Cantidad
                            </span>
                            <span
                              style={{
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: esComplementario ? '#b91c1c' : '#047857',
                                lineHeight: 1,
                              }}
                            >
                              {d.cantidad}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                              {piezasLabel}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.4rem 0.75rem',
                              borderRadius: 999,
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              color: lab.color,
                              background:
                                est === 'RECIBIDA'
                                  ? '#d1fae5'
                                  : esComplementario
                                    ? '#fee2e2'
                                    : '#dbeafe',
                              border: `1px solid ${
                                est === 'RECIBIDA'
                                  ? '#6ee7b7'
                                  : esComplementario
                                    ? '#fecaca'
                                    : '#93c5fd'
                              }`,
                            }}
                          >
                            {lab.text}
                          </span>
                        </td>
                        {mostrarColAcciones && (
                          <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                            {esOrigen && esComplementario ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', fontWeight: 600 }}
                                onClick={() =>
                                  setPartidaReenviar({
                                    id: d.id,
                                    cantidad: d.cantidad,
                                    prenda_id: d.prenda_id,
                                    talla_id: d.talla_id,
                                    costo_id: d.costo_id,
                                    prenda_nombre: d.prenda_nombre,
                                    talla_nombre: d.talla_nombre,
                                  })
                                }
                              >
                                ✏️ Modificar
                              </button>
                            ) : esDestino &&
                              (esComplementario ||
                                (esPendiente && estadoLocal === 'RECIBIDA_PARCIAL')) ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', fontWeight: 600 }}
                                disabled={recibiendoPartidaId === d.id || recibiendo}
                                onClick={() => void handleRecibirPartidaComplementaria(d.id)}
                              >
                                {recibiendoPartidaId === d.id ? '⏳…' : '✅ Recibir'}
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {mostrarChecks && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                background: '#eff6ff',
                borderRadius: '8px',
                color: '#1e40af',
              }}
            >
              Se recibirán <strong>{idsMarcados.length}</strong> de <strong>{pendientesRecibir.length}</strong> partidas
              pendientes en <strong>{sesion?.sucursal_nombre}</strong>.
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              padding: '0.8rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              minHeight: '2.75rem',
              minWidth: '7rem',
              borderRadius: '10px',
              lineHeight: 1.2,
            }}
          >
            Cerrar
          </button>
          {puedeCancelar && (
            <button
              type="button"
              className="btn"
              onClick={() => void handleCancelar()}
              disabled={cancelando || recibiendo}
              style={{
                padding: '0.8rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                minHeight: '2.75rem',
                borderRadius: '10px',
                lineHeight: 1.2,
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fecaca',
              }}
            >
              {cancelando ? '⏳ Cancelando…' : '❌ Cancelar transferencia'}
            </button>
          )}
          {mostrarChecks && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRecibir}
              disabled={recibiendo || loading || ningunoMarcado || cancelando}
              style={{
                padding: '0.8rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                minHeight: '2.75rem',
                borderRadius: '10px',
                lineHeight: 1.2,
              }}
            >
              {recibiendo
                ? '⏳ Recibiendo…'
                : idsMarcados.length === pendientesRecibir.length
                  ? '✅ Confirmar recepción'
                  : `✅ Recibir ${idsMarcados.length} partida${idsMarcados.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>

      {partidaReenviar && (
        <ModalReenviarComplementario
          transferenciaId={transferencia.id}
          folio={transferencia.folio}
          partida={partidaReenviar}
          onClose={() => setPartidaReenviar(null)}
          onOk={() => void trasReenvio()}
        />
      )}
    </div>,
    document.body
  );
}

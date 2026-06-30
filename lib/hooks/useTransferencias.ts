'use client';

import { useState, useEffect, useCallback } from 'react';
import { insforgeDb } from '@/lib/insforgeBrowser';
import { Transferencia } from '../types';

async function enriquecerTransferencias(rows: Record<string, unknown>[]): Promise<Transferencia[]> {
  if (!rows.length) return [];

  const sucIds = new Set<string>();
  const usuarioIds = new Set<number>();
  for (const r of rows) {
    const o = r.sucursal_origen_id ?? r.sucursalOrigenId;
    const d = r.sucursal_destino_id ?? r.sucursalDestinoId;
    if (o) sucIds.add(String(o));
    if (d) sucIds.add(String(d));
    const uid = r.usuario_id ?? r.usuarioId;
    if (uid != null) {
      const n = Number(uid);
      if (!Number.isNaN(n)) usuarioIds.add(n);
    }
  }

  const sucPorId = new Map<string, NonNullable<Transferencia['sucursal_origen']>>();
  if (sucIds.size > 0) {
    const sr = await insforgeDb()
      .from('sucursales')
      .select('id, codigo, nombre, direccion, telefono, es_matriz, activo')
      .in('id', [...sucIds]);
    if (!sr.error && sr.data) {
      for (const s of sr.data) {
        const row = s as Record<string, unknown>;
        sucPorId.set(String(row.id), {
          id: String(row.id),
          codigo: String(row.codigo ?? ''),
          nombre: String(row.nombre ?? ''),
          direccion: row.direccion != null ? String(row.direccion) : null,
          telefono: row.telefono != null ? String(row.telefono) : null,
          es_matriz: Boolean(row.es_matriz ?? row.esMatriz),
          activo: Boolean(row.activo ?? true),
        });
      }
    }
  }

  const usuarioPorId = new Map<number, NonNullable<Transferencia['usuario']>>();
  if (usuarioIds.size > 0) {
    const ur = await insforgeDb()
      .from('usuario')
      .select('usuario_id, usuario_username, usuario_nombre')
      .in('usuario_id', [...usuarioIds]);
    if (!ur.error && ur.data) {
      for (const u of ur.data) {
        const row = u as Record<string, unknown>;
        const id = Number(row.usuario_id ?? row.usuarioId);
        usuarioPorId.set(id, {
          usuario_id: id,
          usuario_username: String(row.usuario_username ?? row.usuarioUsername ?? ''),
          usuario_nombre: String(row.usuario_nombre ?? row.usuarioNombre ?? ''),
        } as NonNullable<Transferencia['usuario']>);
      }
    }
  }

  return rows.map((r) => {
    const origenId = String(r.sucursal_origen_id ?? r.sucursalOrigenId ?? '');
    const destinoId = String(r.sucursal_destino_id ?? r.sucursalDestinoId ?? '');
    const uid = r.usuario_id ?? r.usuarioId;
    const usuarioNum = uid != null ? Number(uid) : NaN;
    return {
      ...(r as unknown as Transferencia),
      sucursal_origen: sucPorId.get(origenId),
      sucursal_destino: sucPorId.get(destinoId),
      usuario: !Number.isNaN(usuarioNum) ? usuarioPorId.get(usuarioNum) : undefined,
    };
  });
}

export function useTransferencias(sucursalId?: string) {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarTransferencias = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = insforgeDb()
        .from('transferencias')
        .select('*')
        .order('created_at', { ascending: false });

      if (sucursalId) {
        query = query.or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const enriched = await enriquecerTransferencias((data || []) as Record<string, unknown>[]);
      setTransferencias(enriched);
    } catch (err) {
      console.error('Error cargando transferencias:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [sucursalId]);

  useEffect(() => {
    cargarTransferencias();
  }, [cargarTransferencias]);

  const recargar = useCallback(() => {
    cargarTransferencias();
  }, [cargarTransferencias]);

  return {
    transferencias,
    loading,
    error,
    recargar,
  };
}

export async function crearTransferencia(
  sucursal_origen_id: string,
  sucursal_destino_id: string,
  _usuario_id: number,
  detalles: Array<{ prenda_id: string; talla_id: string; cantidad: number; costo_id: string }>,
  observaciones?: string
) {
  const res = await fetch('/api/transferencias/crear', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sucursal_destino_id,
      observaciones,
      detalles,
    }),
  });
  const json = (await res.json()) as { ok?: boolean; message?: string; transferencia?: unknown };
  if (!res.ok || !json.ok) {
    throw new Error(json.message ?? 'No se pudo crear la transferencia.');
  }
  return json.transferencia;
}

export async function procesarTransferencia(transferencia_id: string) {
  const res = await fetch('/api/transferencias/recibir', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transferencia_id }),
  });
  const json = (await res.json()) as { ok?: boolean; message?: string; transferencia?: unknown };
  if (!res.ok || !json.ok) {
    throw new Error(json.message ?? 'No se pudo recibir la transferencia.');
  }
  return json.transferencia;
}

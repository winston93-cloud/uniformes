import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';
import { getSyncState, upsertSyncState } from '@/lib/migracion/syncState';

const TABLAS_UNIFORMES = [
  'usuario_perfil',
  'roles_uniformes',
  'tallas',
  'categorias_prendas',
  'presentaciones',
  'ubicaciones_almacenamiento',
  'sucursales',
  'ciclos_escolares',
  'usuario',
  'usuarios',
  'usuarios_uniformes',
  'alumnos',
  'externos',
  'prendas',
  'insumos',
  'costos',
  'prenda_talla_insumos',
  'compras_insumos',
  'costo_ubicaciones',
  'insumo_ubicaciones',
  'datos_fiscales_cliente',
  'cotizaciones',
  'detalle_cotizacion',
  'pedidos',
  'detalle_pedidos',
  'movimientos',
  'cortes',
  'detalle_cortes',
  'transferencias',
  'detalle_transferencias',
  'devoluciones',
  'detalle_devoluciones',
  'auditoria',
  'snapshot_insumos_pedido',
] as const;

type AuditRow = {
  id: string;
  tabla: string;
  operacion: string;
  timestamp: string;
  registro_pk_col?: string | null;
  datos_anteriores?: any;
  datos_nuevos?: any;
};

function guessPkCol(rowObj: any) {
  if (!rowObj || typeof rowObj !== 'object') return null;
  if (rowObj.id !== undefined) return 'id';
  if (rowObj.usuario_id !== undefined) return 'usuario_id';
  if (rowObj.perfil_id !== undefined) return 'perfil_id';
  return null;
}

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(50, Math.min(2000, Number(body?.limit || 500)));

    const state = await getSyncState();
    const baselineTs = state?.baseline_ts ?? null;
    const lastApplied = state?.last_applied_ts ?? baselineTs ?? null;
    if (!lastApplied) {
      return NextResponse.json({ success: false, error: 'No hay baseline. Ejecuta sync-baseline primero.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('auditoria')
      .select('id,tabla,operacion,timestamp,registro_pk_col,datos_anteriores,datos_nuevos')
      .gt('timestamp', lastApplied)
      .in('tabla', [...TABLAS_UNIFORMES])
      .order('timestamp', { ascending: true })
      .limit(limit);
    if (error) throw error;

    const rows = (data || []) as AuditRow[];
    let applied = 0;
    let skipped = 0;
    const errors: Array<{ auditoriaId: string; tabla: string; operacion: string; reason: string }> = [];

    for (const r of rows) {
      const op = String(r.operacion || '').toUpperCase();
      const obj = op === 'DELETE' ? r.datos_anteriores : r.datos_nuevos;
      const pkCol = (r.registro_pk_col || '').trim() || guessPkCol(obj);
      const pkVal = pkCol && obj ? obj[pkCol] : null;

      if (!pkCol || pkVal === null || pkVal === undefined) {
        skipped += 1;
        errors.push({ auditoriaId: r.id, tabla: r.tabla, operacion: op, reason: 'Sin PK (registro_pk_col/heurística) para aplicar.' });
        continue;
      }

      try {
        if (op === 'DELETE') {
          const { error: delErr } = await (insforge.database as any).from(r.tabla).delete().eq(pkCol, pkVal);
          if (delErr) throw delErr;
        } else if (op === 'INSERT' || op === 'UPDATE') {
          const { error: upErr } = await (insforge.database as any).from(r.tabla).upsert([obj], { onConflict: pkCol });
          if (upErr) throw upErr;
        } else {
          skipped += 1;
          continue;
        }
        applied += 1;
      } catch (e: any) {
        skipped += 1;
        errors.push({ auditoriaId: r.id, tabla: r.tabla, operacion: op, reason: e?.message || String(e) });
      }
    }

    const newLastApplied = rows.length ? rows[rows.length - 1].timestamp : lastApplied;
    if (rows.length) {
      await upsertSyncState({ last_applied_ts: newLastApplied });
    }

    return NextResponse.json({
      success: true,
      baselineTs,
      lastAppliedTsBefore: lastApplied,
      lastAppliedTsAfter: newLastApplied,
      fetched: rows.length,
      applied,
      skipped,
      errors: errors.slice(0, 50),
      hasMore: rows.length === limit,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


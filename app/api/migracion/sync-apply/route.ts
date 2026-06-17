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
  'alumno',
  'externos',
  'prendas',
  'insumos',
  'costos',
  'prenda_talla_insumos',
  'compras_insumos',
  'costo_ubicaciones',
  'insumo_ubicaciones',
  'datos_fiscales_cliente',
  'sat_metodos_pago',
  'sat_formas_pago',
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
  'snapshot_insumos_pedido',
] as const;

const TABLA_ORDER = new Map<string, number>(TABLAS_UNIFORMES.map((t, i) => [t, i]));

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableRateLimitError(err: any) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('429') || msg.includes('too many') || msg.includes('rate');
}

function isLikelyFkViolation(err: any) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('foreign key') || msg.includes('violates foreign key') || msg.includes('23503');
}

async function insforgeWriteWithRetry(fn: () => Promise<any>) {
  // Plan free: throttle + retry simple con backoff
  const baseDelayMs = 250;
  const maxRetries = 5;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(baseDelayMs);
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (e: any) {
      if (!isRetryableRateLimitError(e) || attempt === maxRetries) throw e;
      const backoff = baseDelayMs * Math.pow(2, attempt);
      // eslint-disable-next-line no-await-in-loop
      await sleep(backoff);
    }
  }
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

    const rows0 = (data || []) as AuditRow[];
    // Aplicar primero en orden de dependencias (tabla), y dentro por timestamp
    const rows = [...rows0].sort((a, b) => {
      const oa = TABLA_ORDER.get(a.tabla) ?? 9999;
      const ob = TABLA_ORDER.get(b.tabla) ?? 9999;
      if (oa !== ob) return oa - ob;
      return a.timestamp.localeCompare(b.timestamp);
    });
    let applied = 0;
    let skipped = 0;
    const errors: Array<{ auditoriaId: string; tabla: string; operacion: string; reason: string }> = [];
    let lastSuccessTs: string | null = null;
    let stoppedByError = false;

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
          await insforgeWriteWithRetry(async () => {
            const { error: delErr } = await (insforge.database as any).from(r.tabla).delete().eq(pkCol, pkVal);
            if (delErr) throw delErr;
          });
        } else if (op === 'INSERT' || op === 'UPDATE') {
          await insforgeWriteWithRetry(async () => {
            const { error: upErr } = await (insforge.database as any).from(r.tabla).upsert([obj], { onConflict: pkCol });
            if (upErr) throw upErr;
          });
        } else {
          skipped += 1;
          continue;
        }
        applied += 1;
        lastSuccessTs = r.timestamp;
      } catch (e: any) {
        const reason = e?.message || String(e);
        errors.push({ auditoriaId: r.id, tabla: r.tabla, operacion: op, reason });
        // Para evitar gaps, nos detenemos si parece integridad/FK u otro fallo no-rate-limit,
        // así no avanzamos last_applied_ts más allá de lo aplicado realmente.
        if (isLikelyFkViolation(e) || !isRetryableRateLimitError(e)) {
          stoppedByError = true;
          break;
        }
        skipped += 1;
      }
    }

    const newLastApplied = lastSuccessTs ?? lastApplied;
    if (newLastApplied !== lastApplied) {
      await upsertSyncState({ last_applied_ts: newLastApplied });
    }

    return NextResponse.json({
      success: true,
      baselineTs,
      lastAppliedTsBefore: lastApplied,
      lastAppliedTsAfter: newLastApplied,
      fetched: rows0.length,
      applied,
      skipped,
      errors: errors.slice(0, 50),
      hasMore: !stoppedByError && rows0.length === limit,
      stoppedByError,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


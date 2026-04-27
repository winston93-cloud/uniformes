import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSyncState } from '@/lib/migracion/syncState';

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

export async function GET() {
  try {
    const state = await getSyncState();
    const baselineTs = state?.baseline_ts ?? null;
    const lastApplied = state?.last_applied_ts ?? baselineTs ?? null;

    if (!lastApplied) {
      return NextResponse.json({ success: true, baselineTs, lastAppliedTs: null, pendingCount: null });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { count, error } = await supabaseAdmin
      .from('auditoria')
      .select('*', { count: 'estimated', head: true })
      .gt('timestamp', lastApplied)
      .in('tabla', [...TABLAS_UNIFORMES]);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      baselineTs,
      lastAppliedTs: lastApplied,
      pendingCount: typeof count === 'number' ? count : null,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


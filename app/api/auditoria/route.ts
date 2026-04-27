import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSupabaseErrorMessage } from '@/lib/supabase';

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function supabaseHostFromUrl(url: string | undefined | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const desde = url.searchParams.get('desde'); // YYYY-MM-DD
    const hasta = url.searchParams.get('hasta'); // YYYY-MM-DD
    const tabla = url.searchParams.get('tabla');
    const operacion = url.searchParams.get('operacion'); // INSERT/UPDATE/DELETE

    const limit = clampInt(Number(url.searchParams.get('limit') || 100), 1, 500);
    const offset = clampInt(Number(url.searchParams.get('offset') || 0), 0, 50_000);

    // Evitar full-scan accidental: si no mandan rango, default a últimos 7 días.
    const now = new Date();
    const defaultDesde = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const defaultHasta = now.toISOString();

    let q = supabase
      .from('auditoria')
      // Evitar `count: 'exact'` (caro) para no disparar statement timeout.
      .select('id,tabla,operacion,registro_id,registro_pk,usuario_id,timestamp,datos_anteriores,datos_nuevos')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tabla && tabla.trim()) {
      q = q.eq('tabla', tabla.trim());
    } else {
      // Esta instancia comparte BD con otros sistemas. Para que la Bitácora sea confiable
      // en Uniformes, si NO filtras por tabla aplicamos lista blanca (solo tablas del sistema).
      q = q.in('tabla', [...TABLAS_UNIFORMES]);
    }
    if (operacion && operacion.trim()) {
      q = q.eq('operacion', operacion.trim().toUpperCase());
    }
    if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte('timestamp', `${desde}T00:00:00.000Z`);
    else q = q.gte('timestamp', defaultDesde);

    if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte('timestamp', `${hasta}T23:59:59.999Z`);
    else q = q.lte('timestamp', defaultHasta);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      rows: data || [],
      count: null,
      limit,
      offset,
      debug: {
        supabaseHost: supabaseHostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
        serverNowIso: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: getSupabaseErrorMessage(err) },
      { status: 500 }
    );
  }
}


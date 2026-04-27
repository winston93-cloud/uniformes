import { NextResponse } from 'next/server';
import { runInsforgeRawSql } from '@/lib/insforgeAdminRawSql';

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

export async function GET() {
  try {
    const q = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const r = await runInsforgeRawSql<{ rows?: Array<{ table_name: string }> }>(q);
    const tables = (r?.rows || []).map((x) => x.table_name).filter(Boolean);

    const allow = new Set<string>(TABLAS_UNIFORMES);
    const found = tables.filter((t) => allow.has(t));
    const missing = TABLAS_UNIFORMES.filter((t) => !tables.includes(t));
    const extras = tables.filter((t) => !allow.has(t));

    return NextResponse.json({
      success: true,
      totalPublicTables: tables.length,
      foundUniformes: found,
      missingUniformes: missing,
      extrasPublic: extras,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}


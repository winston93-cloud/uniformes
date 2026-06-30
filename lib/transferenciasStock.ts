import { normalizarCamposCostoApi } from '@/lib/costoQueries';

// Cliente InsForge server-side (PostgREST + rpc)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

function readStr(row: Record<string, unknown>, snake: string, camel: string): string {
  const v = row[snake] ?? row[camel];
  return v != null ? String(v).trim() : '';
}

function readStock(row: Record<string, unknown>): number {
  return Math.max(0, Math.trunc(Number(row.stock ?? 0)));
}

async function descontarUbicacionesSiExisten(db: DbClient, costoId: string, cantidad: number) {
  const { error } = await db.rpc('descontar_costo_ubicaciones_desde_menor', {
    p_costo_id: costoId,
    p_cantidad: cantidad,
  });
  if (error) {
    const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
    throw new Error(msg);
  }
}

async function sumarUbicacionesSiExisten(db: DbClient, costoId: string, cantidad: number) {
  const { error } = await db.rpc('sumar_costo_ubicaciones_desde_menor', {
    p_costo_id: costoId,
    p_cantidad: cantidad,
  });
  if (error) {
    const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
    throw new Error(msg);
  }
}

/** Descuenta stock en la sucursal origen al enviar la transferencia. */
export async function descontarStockOrigenTransferencia(
  db: DbClient,
  costoId: string,
  cantidad: number,
  sucursalOrigenId: string
) {
  const res = await db.from('costos').select('*').eq('id', costoId).single();
  const row = res.data as Record<string, unknown> | null;
  if (res.error || !row) throw new Error('Costo de origen no encontrado');

  const norm = normalizarCamposCostoApi(row);
  const sid = readStr(norm, 'sucursal_id', 'sucursalId');
  if (sid !== sucursalOrigenId) {
    throw new Error('El costo no pertenece a la sucursal origen');
  }

  const stock = readStock(norm);
  if (stock < cantidad) {
    throw new Error(`Stock insuficiente: hay ${stock}, se pidieron ${cantidad}`);
  }

  const nuevo = stock - cantidad;
  const up = await db.from('costos').update({ stock: nuevo, stock_inicial: nuevo }).eq('id', costoId);
  if ((up as { error?: unknown }).error) {
    throw new Error(String((up as { error?: { message?: string } }).error?.message ?? 'No se pudo actualizar stock origen'));
  }

  await descontarUbicacionesSiExisten(db, costoId, cantidad);
}

/** Suma stock en la sucursal destino al recibir la transferencia. */
export async function abonarStockDestinoTransferencia(
  db: DbClient,
  origenCostoRaw: Record<string, unknown>,
  sucursalDestinoId: string,
  cantidad: number
): Promise<string> {
  const origen = normalizarCamposCostoApi(origenCostoRaw);
  const prendaId = readStr(origen, 'prenda_id', 'prendaId');
  const tallaId = readStr(origen, 'talla_id', 'tallaId');
  if (!prendaId || !tallaId) throw new Error('Detalle de transferencia incompleto (prenda/talla)');

  const existente = await db
    .from('costos')
    .select('*')
    .eq('prenda_id', prendaId)
    .eq('talla_id', tallaId)
    .eq('sucursal_id', sucursalDestinoId)
    .maybeSingle();

  const fila = existente.data as Record<string, unknown> | null;

  if (fila?.id) {
    const costoId = String(fila.id);
    const prev = readStock(fila);
    const nuevo = prev + cantidad;
    const up = await db.from('costos').update({ stock: nuevo, stock_inicial: nuevo }).eq('id', costoId);
    if ((up as { error?: unknown }).error) {
      throw new Error(String((up as { error?: { message?: string } }).error?.message ?? 'No se pudo actualizar stock destino'));
    }
    try {
      await sumarUbicacionesSiExisten(db, costoId, cantidad);
    } catch {
      /* Destino puede no tener ubicaciones aún; stock agregado en costos basta */
    }
    return costoId;
  }

  const ins = await db
    .from('costos')
    .insert([
      {
        prenda_id: prendaId,
        talla_id: tallaId,
        sucursal_id: sucursalDestinoId,
        precio_venta: origen.precio_venta ?? 0,
        precio_compra: origen.precio_compra ?? 0,
        precio_mayoreo: origen.precio_mayoreo ?? 0,
        precio_menudeo: origen.precio_menudeo ?? 0,
        stock_inicial: cantidad,
        stock: cantidad,
        stock_minimo: origen.stock_minimo ?? 0,
        cantidad_venta: origen.cantidad_venta ?? 0,
        activo: true,
      },
    ])
    .select('id')
    .single();

  const creado = ins.data as { id?: string } | null;
  if (ins.error || !creado?.id) {
    throw new Error(String((ins.error as { message?: string })?.message ?? 'No se pudo crear costo en destino'));
  }
  return String(creado.id);
}

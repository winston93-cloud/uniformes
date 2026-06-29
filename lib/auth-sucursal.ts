import { getInsforge } from '@/lib/insforge';

export type SucursalSesion = {
  sucursal_id: string;
  sucursal_codigo: string;
  sucursal_nombre: string;
  es_matriz: boolean;
};

export async function resolverSucursalMatriz(): Promise<SucursalSesion | null> {
  const envId = process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_ID?.trim();
  if (envId) {
    return {
      sucursal_id: envId,
      sucursal_codigo: process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_CODIGO ?? 'MAT',
      sucursal_nombre: process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_NOMBRE ?? 'Matriz',
      es_matriz: process.env.NEXT_PUBLIC_DEFAULT_ES_MATRIZ !== 'false',
    };
  }

  const { data, error } = await getInsforge()
    .database
    .from('sucursales')
    .select('id,codigo,nombre,es_matriz,activo')
    .eq('activo', true)
    .order('es_matriz', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  const row = data as Record<string, unknown>;
  return {
    sucursal_id: String(row.id),
    sucursal_codigo: String(row.codigo ?? ''),
    sucursal_nombre: String(row.nombre ?? ''),
    es_matriz: Boolean(row.es_matriz),
  };
}

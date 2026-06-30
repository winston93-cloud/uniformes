import { getInsforge } from '@/lib/insforge';
import { normalizarUsuarioLogin } from '@/lib/permisos';

export type SucursalSesion = {
  sucursal_id: string;
  sucursal_codigo: string;
  sucursal_nombre: string;
  es_matriz: boolean;
};

/** Respaldo si la fila del usuario no trae sucursal_id (legacy). */
const CODIGO_SUCURSAL_POR_USUARIO: Record<string, string> = {
  winston: 'SUC-WIN',
};

const CODIGO_MATRIZ_DEFAULT = 'MAT-MAD';

type SucursalRow = {
  id: string;
  codigo: string;
  nombre: string;
  es_matriz: boolean;
  activo?: boolean;
};

function filaASesion(row: SucursalRow): SucursalSesion {
  return {
    sucursal_id: String(row.id),
    sucursal_codigo: String(row.codigo ?? ''),
    sucursal_nombre: String(row.nombre ?? ''),
    es_matriz: Boolean(row.es_matriz),
  };
}

async function cargarSucursalPorId(id: string): Promise<SucursalSesion | null> {
  const { data, error } = await getInsforge()
    .database.from('sucursales')
    .select('id,codigo,nombre,es_matriz,activo')
    .eq('id', id)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data?.id) return null;
  return filaASesion(data as SucursalRow);
}

async function cargarSucursalPorCodigo(codigo: string): Promise<SucursalSesion | null> {
  const { data, error } = await getInsforge()
    .database.from('sucursales')
    .select('id,codigo,nombre,es_matriz,activo')
    .eq('codigo', codigo)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data?.id) return null;
  return filaASesion(data as SucursalRow);
}

/** Tienda por defecto al iniciar sesión (Fase 1). */
export async function resolverSucursalParaUsuario(input: {
  usuario: string;
  sucursal_id?: string | null;
}): Promise<SucursalSesion | null> {
  if (input.sucursal_id) {
    const porId = await cargarSucursalPorId(String(input.sucursal_id));
    if (porId) return porId;
  }

  const login = normalizarUsuarioLogin(input.usuario);
  const codigoMapa = CODIGO_SUCURSAL_POR_USUARIO[login];
  if (codigoMapa) {
    const porCodigo = await cargarSucursalPorCodigo(codigoMapa);
    if (porCodigo) return porCodigo;
  }

  const matriz = await cargarSucursalPorCodigo(CODIGO_MATRIZ_DEFAULT);
  if (matriz) return matriz;

  return resolverSucursalMatriz();
}

/** Matriz activa (taller). Fallback legacy con env. */
export async function resolverSucursalMatriz(): Promise<SucursalSesion | null> {
  const porCodigo = await cargarSucursalPorCodigo(CODIGO_MATRIZ_DEFAULT);
  if (porCodigo) return porCodigo;

  const envId = process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_ID?.trim();
  if (envId) {
    const porEnv = await cargarSucursalPorId(envId);
    if (porEnv) return porEnv;
    return {
      sucursal_id: envId,
      sucursal_codigo: process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_CODIGO ?? 'MAT-MAD',
      sucursal_nombre: process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_NOMBRE ?? 'Matriz',
      es_matriz: true,
    };
  }

  const { data, error } = await getInsforge()
    .database.from('sucursales')
    .select('id,codigo,nombre,es_matriz,activo')
    .eq('activo', true)
    .eq('es_matriz', true)
    .order('codigo', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return filaASesion(data as SucursalRow);
}

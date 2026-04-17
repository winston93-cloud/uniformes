import { supabase, getSupabaseErrorMessage } from '@/lib/supabase';
import type { SesionUsuario } from '@/lib/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function invitadoBase(): Pick<
  SesionUsuario,
  'usuario_id' | 'usuario_username' | 'usuario_email'
> {
  const usuarioId = Number(process.env.NEXT_PUBLIC_INVITADO_USUARIO_ID ?? '1');
  return {
    usuario_id: Number.isFinite(usuarioId) ? usuarioId : 1,
    usuario_username: process.env.NEXT_PUBLIC_INVITADO_USERNAME ?? 'Invitado',
    usuario_email: '',
  };
}

/** Sesión sin consultar Supabase: útil si la API falla (egress, clave, red) pero ya conoces el UUID de la matriz. */
export function sesionDesdeVariablesEntorno(): SesionUsuario | null {
  const id = process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_ID?.trim();
  if (!id) return null;
  return {
    ...invitadoBase(),
    sucursal_id: id,
    sucursal_codigo: process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_CODIGO ?? 'MAT',
    sucursal_nombre: process.env.NEXT_PUBLIC_DEFAULT_SUCURSAL_NOMBRE ?? 'Matriz',
    es_matriz: process.env.NEXT_PUBLIC_DEFAULT_ES_MATRIZ !== 'false',
  };
}

export function supabaseClienteConfigurado(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return Boolean(url && key && !url.includes('placeholder.supabase.co'));
}

async function queryPrimeraSucursalActiva(): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  return supabase
    .from('sucursales')
    .select('id,codigo,nombre,es_matriz,activo')
    .eq('activo', true)
    .order('es_matriz', { ascending: false })
    .limit(1)
    .maybeSingle();
}

function filaASesion(row: Record<string, unknown>): SesionUsuario {
  return {
    ...invitadoBase(),
    sucursal_id: String(row.id),
    sucursal_codigo: String(row.codigo ?? ''),
    sucursal_nombre: String(row.nombre ?? ''),
    es_matriz: Boolean(row.es_matriz),
  };
}

/**
 * Intenta leer la matriz / primera sucursal activa con reintentos; si falla, usa variables de entorno.
 * Devuelve texto de error solo si no hay sesión posible.
 */
export async function resolverSesionInvitado(): Promise<{
  sesion: SesionUsuario | null;
  errorDetalle: string | null;
}> {
  const envSesion = sesionDesdeVariablesEntorno();

  if (!supabaseClienteConfigurado()) {
    if (envSesion) {
      return { sesion: envSesion, errorDetalle: null };
    }
    return {
      sesion: null,
      errorDetalle:
        'El cliente de Supabase no está configurado en Vercel (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY). Opcional: define NEXT_PUBLIC_DEFAULT_SUCURSAL_ID con el UUID de la matriz como respaldo.',
    };
  }

  let ultimoError: unknown = null;
  for (let intento = 0; intento < 3; intento++) {
    const { data, error } = await queryPrimeraSucursalActiva();
    if (!error && data && data.id) {
      return { sesion: filaASesion(data as Record<string, unknown>), errorDetalle: null };
    }
    ultimoError =
      error ?? (!data ? new Error('No hay sucursales con activo=true') : new Error('Respuesta inválida de sucursales'));
    console.error('resolverSesionInvitado intento', intento + 1, ultimoError);
    await sleep(350 * (intento + 1));
  }

  if (envSesion) {
    console.warn('Supabase no respondió; usando NEXT_PUBLIC_DEFAULT_SUCURSAL_ID');
    return { sesion: envSesion, errorDetalle: null };
  }

  const msg = getSupabaseErrorMessage(ultimoError);
  return {
    sesion: null,
    errorDetalle:
      msg ||
      'No se pudo leer la tabla sucursales. Revisa en Supabase que el proyecto esté activo, la anon key sea la actual y exista al menos una sucursal con activo=true. Tras límites de egress, a veces tarda en normalizarse el acceso.',
  };
}

/** @deprecated usar resolverSesionInvitado */
export async function fetchSesionPorDefecto(): Promise<SesionUsuario | null> {
  const { sesion } = await resolverSesionInvitado();
  return sesion;
}

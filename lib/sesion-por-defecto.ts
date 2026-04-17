import { supabase } from '@/lib/supabase';
import type { SesionUsuario } from '@/lib/types';

/**
 * Sesión sin pantalla de login: primera sucursal activa (matriz primero) + usuario invitado.
 * `NEXT_PUBLIC_INVITADO_USUARIO_ID` puede ajustarse si el catálogo `usuario` no usa id 1.
 */
export async function fetchSesionPorDefecto(): Promise<SesionUsuario | null> {
  const { data: sucursal, error } = await supabase
    .from('sucursales')
    .select('*')
    .eq('activo', true)
    .order('es_matriz', { ascending: false })
    .order('nombre')
    .limit(1)
    .maybeSingle();

  if (error || !sucursal) {
    console.error('fetchSesionPorDefecto: sin sucursal', error);
    return null;
  }

  const usuarioId = Number(process.env.NEXT_PUBLIC_INVITADO_USUARIO_ID ?? '1');
  const username = process.env.NEXT_PUBLIC_INVITADO_USERNAME ?? 'Invitado';

  return {
    usuario_id: Number.isFinite(usuarioId) ? usuarioId : 1,
    usuario_username: username,
    usuario_email: '',
    sucursal_id: sucursal.id,
    sucursal_codigo: sucursal.codigo,
    sucursal_nombre: sucursal.nombre,
    es_matriz: Boolean(sucursal.es_matriz),
  };
}

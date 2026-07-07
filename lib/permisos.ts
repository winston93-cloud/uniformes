import type { SesionUsuario } from '@/lib/types';
import { esCuentaWinston } from '@/lib/winstonLineaVenta';

export function esAdministrador(sesion: SesionUsuario | null | undefined): boolean {
  if (!sesion) return false;
  if (sesion.es_admin) return true;
  return sesion.rol_nombre.trim().toLowerCase() === 'administrador';
}

/** Rutas accesibles sin ser administrador (solo lectura básica futura). */
const RUTAS_PUBLICAS_AUTENTICADO = new Set(['/dashboard', '/login']);

export function puedeAccederRuta(sesion: SesionUsuario | null | undefined, pathname: string): boolean {
  if (!sesion) return false;
  if (esAdministrador(sesion)) return true;
  return RUTAS_PUBLICAS_AUTENTICADO.has(pathname);
}

export function normalizarUsuarioLogin(usuario: string): string {
  return usuario.trim().toLowerCase();
}

/** Matriz (uniformes/mario) o solo winston: botones de alta/edición en catálogo. */
export function puedeGestionarCatalogo(sesion: SesionUsuario | null | undefined): boolean {
  if (!sesion) return false;
  if (sesion.es_matriz) return true;
  return esCuentaWinston(sesion);
}

/** Alias explícito: permisos extra de catálogo solo para la cuenta winston. */
export function puedeGestionarCatalogoWinston(sesion: SesionUsuario | null | undefined): boolean {
  return esCuentaWinston(sesion);
}

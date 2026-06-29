import type { SesionUsuario } from '@/lib/types';

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

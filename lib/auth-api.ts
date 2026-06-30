import { cookies } from 'next/headers';
import { COOKIE_NAME, payloadASesionUsuario, verificarTokenSesion } from '@/lib/auth-cookie';
import type { SesionUsuario } from '@/lib/types';
import { esAdministrador } from '@/lib/permisos';

export async function sesionDesdeCookie(): Promise<SesionUsuario | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const payload = await verificarTokenSesion(token);
  if (!payload) return null;
  return payloadASesionUsuario(payload);
}

export async function exigirSesion(): Promise<SesionUsuario | null> {
  return sesionDesdeCookie();
}

export async function exigirMatriz(): Promise<SesionUsuario | null> {
  const sesion = await sesionDesdeCookie();
  if (!sesion?.es_matriz) return null;
  return sesion;
}

export async function exigirAdmin(): Promise<SesionUsuario | null> {
  const sesion = await sesionDesdeCookie();
  if (!sesion || !esAdministrador(sesion)) return null;
  return sesion;
}

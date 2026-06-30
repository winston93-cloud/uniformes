import type { SesionUsuario } from '@/lib/types';

const COOKIE_NAME = 'uniformes_sesion';

/** Duración por defecto: 8 h (jornada). Override: AUTH_SESSION_MAX_AGE_SEC en segundos. */
function resolverMaxAgeSec(): number {
  const raw = process.env.AUTH_SESSION_MAX_AGE_SEC?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 60 * 60 * 8;
}

const MAX_AGE_SEC = resolverMaxAgeSec();

export type SesionCookiePayload = {
  sub: string;
  usuario: string;
  nombre: string;
  correo: string;
  rol_id: string;
  rol_nombre: string;
  es_admin: boolean;
  sucursal_id: string;
  sucursal_codigo: string;
  sucursal_nombre: string;
  es_matriz: boolean;
  exp: number;
};

function secret(): string {
  const s =
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.INSFORGE_ADMIN_TOKEN?.trim() ||
    process.env.INSFORGE_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_INSFORGE_ADMIN_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY?.trim() ||
    process.env.INSFORGE_ANON_KEY?.trim();
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Falta AUTH_SESSION_SECRET o claves InsForge (INSFORGE_ADMIN_TOKEN / NEXT_PUBLIC_INSFORGE_ANON_KEY) en Vercel.'
      );
    }
    return 'uniformes-dev-secret-cambiar-en-prod';
  }
  return s;
}

function toBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(str, 'base64url'));
  }
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function crearTokenSesion(
  payload: Omit<SesionCookiePayload, 'exp'>,
  maxAgeSec = MAX_AGE_SEC
): Promise<string> {
  const full: SesionCookiePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(full)));
  return `${body}.${await sign(body)}`;
}

export async function verificarTokenSesion(token: string | undefined | null): Promise<SesionCookiePayload | null> {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await sign(body);
  if (!timingSafeEqualStr(sig, expected)) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(body));
    const payload = JSON.parse(json) as SesionCookiePayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub || !payload.usuario) return null;
    return payload;
  } catch {
    return null;
  }
}

export function payloadASesionUsuario(p: SesionCookiePayload): SesionUsuario {
  return {
    usuario_uniforme_id: p.sub,
    usuario_id: 1,
    usuario_username: p.usuario,
    usuario_nombre: p.nombre,
    usuario_email: p.correo,
    rol_id: p.rol_id,
    rol_nombre: p.rol_nombre,
    es_admin: p.es_admin,
    sucursal_id: p.sucursal_id,
    sucursal_codigo: p.sucursal_codigo,
    sucursal_nombre: p.sucursal_nombre,
    es_matriz: p.es_matriz,
  };
}

export function cookieHeader(token: string, maxAgeSec = MAX_AGE_SEC): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export { COOKIE_NAME, MAX_AGE_SEC };

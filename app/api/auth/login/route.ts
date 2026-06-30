import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';
import { hashPassword, verifyPassword } from '@/lib/auth-password';
import {
  cookieHeader,
  crearTokenSesion,
  payloadASesionUsuario,
  verificarTokenSesion,
  COOKIE_NAME,
  TOKEN_MAX_AGE_SEC,
} from '@/lib/auth-cookie';
import { normalizarUsuarioLogin } from '@/lib/permisos';
import { resolverSucursalMatriz, resolverSucursalParaUsuario } from '@/lib/auth-sucursal';

type UsuarioRow = {
  id: string;
  nombre: string;
  usuario: string;
  correo: string;
  password_hash: string;
  rol_id: string;
  estado: string;
  sucursal_id?: string | null;
  rol: { nombre: string } | { nombre: string }[] | null;
};

function rolNombre(row: UsuarioRow): string {
  const r = row.rol;
  if (!r) return '';
  if (Array.isArray(r)) return r[0]?.nombre ?? '';
  return r.nombre ?? '';
}

async function buscarPorUsuario(usuario: string): Promise<UsuarioRow | null> {
  const login = normalizarUsuarioLogin(usuario);
  const { data, error } = await getInsforge().database
    .from('usuarios_uniformes')
    .select('id,nombre,usuario,correo,password_hash,rol_id,estado,sucursal_id,rol:roles_uniformes(nombre)')
    .eq('usuario', login)
    .maybeSingle();

  if (error || !data) return null;
  return data as UsuarioRow;
}

async function construirRespuestaSesion(row: UsuarioRow) {
  const sucursal = await resolverSucursalParaUsuario({
    usuario: row.usuario,
    sucursal_id: row.sucursal_id,
  });
  if (!sucursal) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'No se pudo cargar la tienda del usuario. Revisa sucursales activas (MAT-MAD, SUC-WIN) y sucursal_id en usuarios_uniformes.',
      },
      { status: 503 }
    );
  }

  const rolNombreVal = rolNombre(row);
  const esAdmin = rolNombreVal.trim().toLowerCase() === 'administrador';

  const token = await crearTokenSesion({
    sub: row.id,
    usuario: row.usuario,
    nombre: row.nombre,
    correo: row.correo,
    rol_id: row.rol_id,
    rol_nombre: rolNombreVal,
    es_admin: esAdmin,
    ...sucursal,
  });

  const sesion = payloadASesionUsuario({
    sub: row.id,
    usuario: row.usuario,
    nombre: row.nombre,
    correo: row.correo,
    rol_id: row.rol_id,
    rol_nombre: rolNombreVal,
    es_admin: esAdmin,
    ...sucursal,
    exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE_SEC,
  });

  const res = NextResponse.json({ ok: true, sesion });
  res.headers.set('Set-Cookie', cookieHeader(token));
  return res;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { usuario?: string; password?: string };
    const usuario = body.usuario?.trim();
    const password = body.password ?? '';

    if (!usuario || !password) {
      return NextResponse.json({ ok: false, message: 'Indica usuario y contraseña.' }, { status: 400 });
    }

    const row = await buscarPorUsuario(usuario);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return NextResponse.json({ ok: false, message: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }

    if (row.estado !== 'activo') {
      return NextResponse.json(
        { ok: false, message: 'Tu cuenta no está activa. Contacta al administrador.' },
        { status: 403 }
      );
    }

    return construirRespuestaSesion(row);
  } catch (e) {
    console.error('POST /api/auth/login', e);
    return NextResponse.json({ ok: false, message: 'Error al iniciar sesión.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const payload = await verificarTokenSesion(match?.[1]);
  if (!payload) {
    return NextResponse.json({ ok: false, sesion: null }, { status: 401 });
  }
  return NextResponse.json({ ok: true, sesion: payloadASesionUsuario(payload) });
}

/** Primer administrador cuando la tabla está vacía. */
export async function PUT(request: Request) {
  try {
    const { count, error: countErr } = await getInsforge().database
      .from('usuarios_uniformes')
      .select('id', { count: 'exact', head: true });

    if (countErr) throw countErr;
    if ((count ?? 0) > 0) {
      return NextResponse.json({ ok: false, message: 'Ya existen usuarios. Usa login normal.' }, { status: 403 });
    }

    const body = (await request.json()) as {
      nombre?: string;
      usuario?: string;
      correo?: string;
      password?: string;
    };

    const nombre = body.nombre?.trim();
    const usuario = normalizarUsuarioLogin(body.usuario ?? '');
    const correo = body.correo?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!nombre || !usuario || !correo || password.length < 6) {
      return NextResponse.json(
        { ok: false, message: 'Completa nombre, usuario, correo y contraseña (mín. 6 caracteres).' },
        { status: 400 }
      );
    }

    const { data: rolAdmin } = await getInsforge().database
      .from('roles_uniformes')
      .select('id')
      .ilike('nombre', 'administrador')
      .maybeSingle();

    if (!rolAdmin?.id) {
      return NextResponse.json({ ok: false, message: 'No existe el rol Administrador en catálogo.' }, { status: 500 });
    }

    const matriz = await resolverSucursalMatriz();

    const { data: inserted, error: insErr } = await getInsforge().database
      .from('usuarios_uniformes')
      .insert({
        nombre,
        usuario,
        correo,
        password_hash: hashPassword(password),
        rol_id: rolAdmin.id,
        estado: 'activo',
        sucursal_id: matriz?.sucursal_id ?? null,
      })
      .select('id,nombre,usuario,correo,password_hash,rol_id,estado,sucursal_id,rol:roles_uniformes(nombre)')
      .single();

    if (insErr || !inserted) {
      return NextResponse.json(
        { ok: false, message: insErr?.message ?? 'No se pudo crear el administrador.' },
        { status: 500 }
      );
    }

    return construirRespuestaSesion(inserted as UsuarioRow);
  } catch (e) {
    console.error('PUT /api/auth/login bootstrap', e);
    return NextResponse.json({ ok: false, message: 'Error al crear administrador inicial.' }, { status: 500 });
  }
}

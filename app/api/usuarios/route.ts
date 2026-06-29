import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';
import { hashPassword } from '@/lib/auth-password';
import { exigirAdmin } from '@/lib/auth-api';
import { normalizarUsuarioLogin } from '@/lib/permisos';
import type { EstadoUsuarioUniforme } from '@/lib/types';

export async function POST(request: Request) {
  const admin = await exigirAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, message: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      nombre?: string;
      usuario?: string;
      correo?: string;
      password?: string;
      rol_id?: string;
      estado?: EstadoUsuarioUniforme;
    };

    const nombre = body.nombre?.trim();
    const usuario = normalizarUsuarioLogin(body.usuario ?? '');
    const correo = body.correo?.trim().toLowerCase();
    const password = body.password ?? '';
    const rol_id = body.rol_id;
    const estado = body.estado ?? 'activo';

    if (!nombre || !usuario || !correo || !rol_id) {
      return NextResponse.json({ ok: false, message: 'Completa nombre, usuario, correo y rol.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const { data, error } = await getInsforge().database
      .from('usuarios_uniformes')
      .insert({
        nombre,
        usuario,
        correo,
        password_hash: hashPassword(password),
        rol_id,
        estado,
      })
      .select('id,nombre,usuario,correo,rol_id,estado,created_at,updated_at,rol:roles_uniformes(*)')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, usuario: data });
  } catch (e) {
    console.error('POST /api/usuarios', e);
    return NextResponse.json({ ok: false, message: 'Error al crear usuario.' }, { status: 500 });
  }
}

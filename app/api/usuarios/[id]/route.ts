import { NextResponse } from 'next/server';
import { getInsforge } from '@/lib/insforge';
import { hashPassword } from '@/lib/auth-password';
import { exigirAdmin } from '@/lib/auth-api';
import { normalizarUsuarioLogin } from '@/lib/permisos';
import type { EstadoUsuarioUniforme } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const admin = await exigirAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      usuario?: string;
      correo?: string;
      password?: string;
      rol_id?: string;
      estado?: EstadoUsuarioUniforme;
    };

    const update: Record<string, unknown> = {};
    if (body.nombre !== undefined) update.nombre = body.nombre.trim();
    if (body.usuario !== undefined) update.usuario = normalizarUsuarioLogin(body.usuario);
    if (body.correo !== undefined) update.correo = body.correo.trim().toLowerCase();
    if (body.rol_id !== undefined) update.rol_id = body.rol_id;
    if (body.estado !== undefined) update.estado = body.estado;
    if (body.password !== undefined && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
      }
      update.password_hash = hashPassword(body.password);
    }

    const { data, error } = await getInsforge().database
      .from('usuarios_uniformes')
      .update(update)
      .eq('id', id)
      .select('id,nombre,usuario,correo,rol_id,estado,created_at,updated_at,rol:roles_uniformes(*)')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, usuario: data });
  } catch (e) {
    console.error('PATCH /api/usuarios/[id]', e);
    return NextResponse.json({ ok: false, message: 'Error al actualizar usuario.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const admin = await exigirAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await ctx.params;

  if (id === admin.usuario_uniforme_id) {
    return NextResponse.json({ ok: false, message: 'No puedes eliminar tu propia cuenta.' }, { status: 400 });
  }

  try {
    const { error } = await getInsforge().database.from('usuarios_uniformes').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/usuarios/[id]', e);
    return NextResponse.json({ ok: false, message: 'Error al eliminar usuario.' }, { status: 500 });
  }
}

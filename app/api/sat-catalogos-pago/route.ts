import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SatTipo = 'metodo' | 'forma';

function getSupabaseServer() {
  try {
    return getSupabaseAdmin();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase no configurado en el servidor');
    return createClient(url, key, { auth: { persistSession: false } });
  }
}

function tablaDe(tipo: SatTipo) {
  return tipo === 'metodo' ? 'sat_metodos_pago' : 'sat_formas_pago';
}

function mensajeError(err: unknown): string {
  if (err instanceof Error) {
    if (/failed to fetch/i.test(err.message)) {
      return 'No se pudo conectar con la base de datos. Intenta de nuevo.';
    }
    return err.message.split('\n')[0];
  }
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>;
    const msg = [o.message, o.details, o.hint].find((x) => typeof x === 'string') as string | undefined;
    if (msg) {
      if (/duplicate key|23505/i.test(msg)) {
        return 'Esa clave SAT ya existe. Edítala desde la lista.';
      }
      return msg.split('\n')[0];
    }
  }
  return 'Error desconocido';
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const [mRes, fRes] = await Promise.all([
      supabase.from('sat_metodos_pago').select('*').order('orden', { ascending: true }),
      supabase.from('sat_formas_pago').select('*').order('orden', { ascending: true }),
    ]);
    if (mRes.error) throw mRes.error;
    if (fRes.error) throw fRes.error;
    return NextResponse.json({ metodos: mRes.data ?? [], formas: fRes.data ?? [] });
  } catch (err) {
    console.error('GET sat-catalogos-pago:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tipo = body.tipo as SatTipo;
    if (tipo !== 'metodo' && tipo !== 'forma') {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
    }

    const clave = String(body.clave ?? '').trim().toUpperCase();
    const descripcion = String(body.descripcion ?? '').trim();
    if (!clave || !descripcion) {
      return NextResponse.json({ error: 'Clave y descripción son obligatorias' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const tabla = tablaDe(tipo);
    const row = {
      clave,
      descripcion,
      orden: Number(body.orden) || 0,
      activo: body.activo !== false,
      es_default: Boolean(body.es_default),
      updated_at: new Date().toISOString(),
    };

    if (row.es_default) {
      const { error: defErr } = await supabase.from(tabla).update({ es_default: false }).eq('es_default', true);
      if (defErr) throw defErr;
    }

    const id = body.id as string | undefined;
    if (id && !id.startsWith('fallback-')) {
      const { error: upErr } = await supabase.from(tabla).update(row).eq('id', id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabase.from(tabla).insert([row]);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST sat-catalogos-pago:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') as SatTipo | null;
    const id = searchParams.get('id');
    if ((tipo !== 'metodo' && tipo !== 'forma') || !id || id.startsWith('fallback-')) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error: delErr } = await supabase.from(tablaDe(tipo)).delete().eq('id', id);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE sat-catalogos-pago:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}

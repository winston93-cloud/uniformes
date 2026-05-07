import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function optEnv(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toTextOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toPgDateOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nombreCompleto(row: { alumno_nombre?: unknown; alumno_app?: unknown; alumno_apm?: unknown }) {
  return [row.alumno_nombre, row.alumno_app, row.alumno_apm]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function vaciarSupabaseAlumnoPorLotes(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const batchSize = 200;
  let total = 0;
  for (let ronda = 0; ronda < 100000; ronda++) {
    const { data: ids, error: selErr } = await supabaseAdmin
      .from('alumno')
      .select('alumno_id')
      .limit(batchSize);
    if (selErr) throw selErr;
    if (!ids || ids.length === 0) break;

    const inList = (ids as any[])
      .map((r) => r?.alumno_id)
      .filter((x) => x !== null && x !== undefined && x !== '');

    if (inList.length === 0) {
      throw new Error('No se pudieron leer alumno_id para vaciar la tabla alumno');
    }

    const { error: delErr } = await supabaseAdmin.from('alumno').delete().in('alumno_id', inList);
    if (delErr) throw delErr;
    total += inList.length;
  }
  return total;
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  try {
    const url = new URL(req.url);
    const redirectTo = url.searchParams.get('redirect') || '/dashboard';

    const mysqlHost = requiredEnv('MYSQL_HOST');
    const mysqlUser = requiredEnv('MYSQL_USER');
    const mysqlPassword = requiredEnv('MYSQL_PASSWORD');
    const mysqlDatabase = requiredEnv('MYSQL_DATABASE');
    const mysqlPort = toIntOrNull(optEnv('MYSQL_PORT')) ?? 3306;

    const supabaseAdmin = getSupabaseAdmin();

    // 1) Vaciar Supabase (tabla alumno) por lotes (como migrar.php)
    await vaciarSupabaseAlumnoPorLotes(supabaseAdmin);

    // 2) Leer TODO alumno de MySQL
    const conn = await mysql.createConnection({
      host: mysqlHost,
      user: mysqlUser,
      password: mysqlPassword,
      database: mysqlDatabase,
      port: mysqlPort,
      ssl: optEnv('MYSQL_SSL') === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    let rows: any[] = [];
    try {
      const [r] = await conn.execute(
        `
        SELECT
          alumno_ref,
          alumno_app,
          alumno_apm,
          alumno_nombre,
          alumno_nivel,
          alumno_grado,
          alumno_grupo,
          alumno_nuevo_ingreso,
          alumno_registro,
          alumno_alta,
          alumno_actualizacion,
          alumno_boleta,
          mes,
          alumno_status,
          alumno_ciclo_escolar
        FROM alumno
        ORDER BY alumno_actualizacion ASC
        `
      );
      rows = (r as any[]) || [];
    } finally {
      await conn.end();
    }

    // 3) Mapear y upsert en lotes
    const mapped = rows
      .map((r: any) => {
        const ref = toTextOrNull(r.alumno_ref);
        if (!ref) return null;
        const alumno_nombre = toTextOrNull(r.alumno_nombre);
        const alumno_app = toTextOrNull(r.alumno_app);
        const alumno_apm = toTextOrNull(r.alumno_apm);
        const full = nombreCompleto({ alumno_nombre, alumno_app, alumno_apm }) || null;
        return {
          alumno_ref: ref,
          alumno_app,
          alumno_apm,
          alumno_nombre,
          alumno_nivel: toIntOrNull(r.alumno_nivel),
          alumno_grado: toIntOrNull(r.alumno_grado),
          alumno_grupo: toIntOrNull(r.alumno_grupo),
          alumno_nuevo_ingreso: toIntOrNull(r.alumno_nuevo_ingreso),
          alumno_registro: toPgDateOrNull(r.alumno_registro),
          alumno_alta: toIsoOrNull(r.alumno_alta),
          alumno_actualizacion: toIsoOrNull(r.alumno_actualizacion) ?? new Date().toISOString(),
          alumno_boleta: toIntOrNull(r.alumno_boleta),
          mes: toIntOrNull(r.mes),
          alumno_status: toIntOrNull(r.alumno_status),
          alumno_ciclo_escolar: toIntOrNull(r.alumno_ciclo_escolar),
          alumno_nombre_completo: full,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    const chunkSize = 500;
    for (let i = 0; i < mapped.length; i += chunkSize) {
      const chunk = mapped.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin.from('alumno').upsert(chunk, { onConflict: 'alumno_ref' });
      if (error) throw error;
    }

    const ms = Date.now() - startedAt;
    // Redirige a dashboard (o destino) tras completar
    return NextResponse.redirect(new URL(`${redirectTo}?sync=ok&ms=${ms}`, url.origin));
  } catch (e: any) {
    const url = new URL(req.url);
    const message = e?.message || String(e);
    return NextResponse.redirect(new URL(`/dashboard?sync=error&msg=${encodeURIComponent(message)}`, url.origin));
  }
}


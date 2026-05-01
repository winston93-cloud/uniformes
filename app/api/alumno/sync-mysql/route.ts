import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const BodySchema = z
  .object({
    /** Límite por corrida (protección). */
    limit: z.number().int().positive().max(20000).default(5000),
    /** Forzar desde una fecha ISO (opcional). Si no, usa MAX(alumno_actualizacion) en Supabase. */
    since: z.string().min(10).optional(),
  })
  .default({ limit: 5000 });

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function optEnv(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function nombreCompleto(row: {
  alumno_nombre?: unknown;
  alumno_app?: unknown;
  alumno_apm?: unknown;
}) {
  return [row.alumno_nombre, row.alumno_app, row.alumno_apm]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .join(' ')
    .trim();
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
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(req: Request) {
  try {
    const bodyRaw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Body inválido', issues: parsed.error.issues }, { status: 400 });
    }

    const { limit, since } = parsed.data;
    const supabaseAdmin = getSupabaseAdmin();

    let sinceTs: string | null = since ? toIsoOrNull(since) : null;
    if (!sinceTs) {
      // Nota: `alumno_actualizacion` existe y trae timestamptz en Supabase.
      const { data, error } = await supabaseAdmin
        .from('alumno')
        .select('alumno_actualizacion')
        .order('alumno_actualizacion', { ascending: false })
        .limit(1);
      if (error) throw error;
      const last = (data?.[0] as any)?.alumno_actualizacion;
      sinceTs = last ? toIsoOrNull(last) : null;
    }

    const mysqlHost = requiredEnv('MYSQL_HOST');
    const mysqlUser = requiredEnv('MYSQL_USER');
    const mysqlPassword = requiredEnv('MYSQL_PASSWORD');
    const mysqlDatabase = requiredEnv('MYSQL_DATABASE');
    const mysqlPort = toIntOrNull(optEnv('MYSQL_PORT')) ?? 3306;

    const conn = await mysql.createConnection({
      host: mysqlHost,
      user: mysqlUser,
      password: mysqlPassword,
      database: mysqlDatabase,
      port: mysqlPort,
      ssl: optEnv('MYSQL_SSL') === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    try {
      // Seleccionamos SOLO columnas que existen en Supabase hoy (evita tocar esquema por ahora).
      // `alumno_ref` en MySQL puede ser numeric; lo convertimos a string para Supabase (TEXT).
      const where = sinceTs ? 'WHERE alumno_actualizacion > ?' : '';
      const params: any[] = [];
      if (sinceTs) params.push(new Date(sinceTs));
      params.push(limit);

      const [rows] = await conn.execute(
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
        ${where}
        ORDER BY alumno_actualizacion ASC
        LIMIT ?
        `,
        params
      );

      const raw = (rows as any[]) || [];
      const mapped = raw
        .map((r) => {
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
            alumno_registro: toTextOrNull(r.alumno_registro), // date string ok
            alumno_alta: toIsoOrNull(r.alumno_alta), // si viene date, lo convertimos a ISO
            alumno_actualizacion: toIsoOrNull(r.alumno_actualizacion) ?? new Date().toISOString(),
            alumno_boleta: toIntOrNull(r.alumno_boleta),
            mes: toIntOrNull(r.mes),
            alumno_status: toIntOrNull(r.alumno_status),
            alumno_ciclo_escolar: toIntOrNull(r.alumno_ciclo_escolar),
            alumno_nombre_completo: full,
          };
        })
        .filter(Boolean) as Record<string, unknown>[];

      const totalFetched = raw.length;
      const totalMapped = mapped.length;

      // Upsert por alumno_ref (unique en Supabase)
      const chunkSize = 1000;
      let upserted = 0;
      for (let i = 0; i < mapped.length; i += chunkSize) {
        const chunk = mapped.slice(i, i + chunkSize);
        const { error } = await supabaseAdmin.from('alumno').upsert(chunk, { onConflict: 'alumno_ref' });
        if (error) throw error;
        upserted += chunk.length;
      }

      const lastTs = mapped.length
        ? String(mapped[mapped.length - 1]?.alumno_actualizacion ?? '')
        : sinceTs;

      return NextResponse.json({
        success: true,
        sinceTs,
        fetched: totalFetched,
        mapped: totalMapped,
        upserted,
        lastAppliedTs: lastTs || null,
        hasMore: totalFetched === limit,
      });
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    // Devolver 200 con success=false para que el frontend siempre pueda leer JSON y mostrar el error real.
    return NextResponse.json({ success: false, error: e?.message || String(e) });
  }
}


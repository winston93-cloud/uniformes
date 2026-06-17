import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { z } from 'zod';
import { getInsforge, assertInsforgeConfigured } from '@/lib/insforge';
import { sendEmailReport } from '@/lib/emailReport';

export const runtime = 'nodejs';

function parsePositiveInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

const BodySchema = z
  .object({
    /** Límite por corrida (protección). */
    limit: z.number().int().positive().max(20000).default(5000),
    /** Forzar desde una fecha ISO (opcional). Si no, usa MAX(alumno_actualizacion) en InsForge. */
    since: z.string().min(10).optional(),
    /** true = ignorar última fecha en InsForge y traer todos los del filtro de ciclo (recuperación). */
    full: z.boolean().optional(),
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

function toPgDateOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  // Vercel Cron hace requests GET; delegamos a POST con defaults.
  // Permite opcionalmente: ?limit=5000&since=2026-05-01T00:00:00.000Z
  const url = new URL(req.url);
  const limit = parsePositiveInt(url.searchParams.get('limit'), 5000, 1, 20000);
  const since = url.searchParams.get('since') ?? undefined;
  const full = url.searchParams.get('full') === '1' || url.searchParams.get('full') === 'true';
  return POST(
    new Request(req.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit, ...(since ? { since } : {}), ...(full ? { full: true } : {}) }),
    })
  );
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    const bodyRaw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Body inválido', issues: parsed.error.issues }, { status: 400 });
    }

    const { limit, since, full } = parsed.data;
    assertInsforgeConfigured();
    const db = getInsforge().database;

    let sinceTs: string | null = full ? null : since ? toIsoOrNull(since) : null;
    if (!sinceTs && !full) {
      const { data, error } = await db
        .from('alumno')
        .select('alumno_actualizacion')
        .order('alumno_actualizacion', { ascending: false })
        .limit(1);
      if (error) throw error;
      const last = (data?.[0] as { alumno_actualizacion?: string })?.alumno_actualizacion;
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
      connectTimeout: 15_000,
      ssl: optEnv('MYSQL_SSL') === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    try {
      // Seleccionamos SOLO columnas que existen en Supabase hoy (evita tocar esquema por ahora).
      // `alumno_ref` en MySQL puede ser numeric; lo convertimos a string para Supabase (TEXT).
      const where = sinceTs
        ? 'WHERE alumno_actualizacion > ? AND alumno_ciclo_escolar IN (22, 23)'
        : 'WHERE alumno_ciclo_escolar IN (22, 23)';
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
            // En Supabase es tipo DATE: enviar YYYY-MM-DD (no "Tue Feb 03 ...")
            alumno_registro: toPgDateOrNull(r.alumno_registro),
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

      // Upsert por alumno_ref (unique en InsForge)
      const chunkSize = 1000;
      let upserted = 0;
      for (let i = 0; i < mapped.length; i += chunkSize) {
        const chunk = mapped.slice(i, i + chunkSize);
        const { error } = await db.from('alumno').upsert(chunk, { onConflict: 'alumno_ref' });
        if (error) throw error;
        upserted += chunk.length;
      }

      const lastTs = mapped.length
        ? String(mapped[mapped.length - 1]?.alumno_actualizacion ?? '')
        : sinceTs;

      const payload = {
        success: true,
        sinceTs,
        full: Boolean(full),
        fetched: totalFetched,
        mapped: totalMapped,
        upserted,
        lastAppliedTs: lastTs || null,
        hasMore: totalFetched === limit,
      } as const;

      // Notificar por email (no bloquea si falla)
      try {
        const ms = Date.now() - startedAt;
        const host = process.env.MYSQL_HOST ?? '';
        const subject = `Uniformes: sync alumnos OK (upsert=${upserted}, fetched=${totalFetched})`;
        const text = [
          'Sincronización de alumnos (MySQL → InsForge) completada.',
          '',
          `MYSQL_HOST: ${host}`,
          `Desde (sinceTs): ${sinceTs ?? '—'}`,
          `Last applied: ${payload.lastAppliedTs ?? '—'}`,
          `Fetched: ${totalFetched}`,
          `Mapped: ${totalMapped}`,
          `Upserted: ${upserted}`,
          `Has more: ${payload.hasMore}`,
          `Duración: ${ms} ms`,
        ].join('\n');
        await sendEmailReport({ subject, text });
      } catch {
        // ignore
      }

      return NextResponse.json(payload);
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    const message = e?.message || String(e);
    // Notificar error por email (no bloquea si falla)
    try {
      const ms = Date.now() - startedAt;
      const host = process.env.MYSQL_HOST ?? '';
      const subject = 'Uniformes: sync alumnos ERROR';
      const text = [
        'Sincronización de alumnos (MySQL → InsForge) falló.',
        '',
        `MYSQL_HOST: ${host}`,
        `Duración: ${ms} ms`,
        '',
        `Error: ${message}`,
      ].join('\n');
      await sendEmailReport({ subject, text });
    } catch {
      // ignore
    }

    // Devolver 200 con success=false para que el frontend siempre pueda leer JSON y mostrar el error real.
    return NextResponse.json({ success: false, error: message });
  }
}


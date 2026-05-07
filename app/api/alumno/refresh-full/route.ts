import { NextResponse } from 'next/server';
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

function parsePositiveInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  try {
    const url = new URL(req.url);
    const redirectTo = url.searchParams.get('redirect') || '/dashboard';
    const limit = parsePositiveInt(url.searchParams.get('limit'), 5000, 1, 20000);

    const supabaseAdmin = getSupabaseAdmin();

    // Refresh "safe" en Vercel: delega a sync incremental existente.
    // (Evita timeouts de vaciado + carga completa en una sola invocación).
    const res = await fetch(new URL(`/api/alumno/sync-mysql?limit=${limit}`, url.origin), {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const json = await res.json().catch(() => null);
    if (!json?.success) {
      throw new Error(json?.error || `Sync incremental falló (HTTP ${res.status})`);
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


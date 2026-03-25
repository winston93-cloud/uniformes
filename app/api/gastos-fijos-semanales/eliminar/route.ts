import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';

export const runtime = 'nodejs';

function getWeekStartISO(date: Date, timeZone = 'America/Mexico_City') {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = dtf.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  if (!year || !month || !day) throw new Error('No se pudo calcular la fecha de semana');

  const localMidnightUTC = new Date(Date.UTC(year, month - 1, day));
  const weekday = localMidnightUTC.getUTCDay(); // 0..6 (Sun..Sat) para el día local
  const offsetToMonday = (weekday + 6) % 7; // Monday => 0
  localMidnightUTC.setUTCDate(localMidnightUTC.getUTCDate() - offsetToMonday);

  return localMidnightUTC.toISOString().slice(0, 10);
}

const BodySchema = z.object({
  nombre: z.string().trim().min(1).max(255),
});

export async function POST(request: NextRequest) {
  try {
    assertInsforgeConfigured();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'JSON inválido o malformado' }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
        { status: 400 }
      );
    }

    const nombre = parsed.data.nombre;
    const semanaFechaInicio = getWeekStartISO(new Date());

    const { data: semanaExisting, error: semanaSelErr } = await insforge.database
      .from('semanas')
      .select('id')
      .eq('fecha_inicio', semanaFechaInicio)
      .maybeSingle();

    if (semanaSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando semanas: ${semanaSelErr.message}` }, { status: 500 });
    }

    if (!semanaExisting?.id) {
      return NextResponse.json({ success: true, gastosGuardados: [] });
    }

    const { data: headerExisting, error: headerSelErr } = await insforge.database
      .from('gastos_fijos_semanales')
      .select('id')
      .eq('semana_id', semanaExisting.id)
      .maybeSingle();

    if (headerSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando gastos_fijos_semanales: ${headerSelErr.message}` }, { status: 500 });
    }

    if (!headerExisting?.id) {
      return NextResponse.json({ success: true, gastosGuardados: [] });
    }

    const { data: catalogRow, error: catalogSelErr } = await insforge.database
      .from('gastos_fijos_catalogo')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle();

    if (catalogSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando catalogo: ${catalogSelErr.message}` }, { status: 500 });
    }

    if (!catalogRow?.id) {
      return NextResponse.json({ success: true, gastosGuardados: [] });
    }

    const { error: detalleDelErr } = await insforge.database
      .from('gastos_fijos_semanales_detalle')
      .delete()
      .eq('gastos_fijos_semanales_id', headerExisting.id)
      .eq('gasto_fijo_catalogo_id', catalogRow.id);
    if (detalleDelErr) {
      return NextResponse.json({ success: false, error: `Error eliminando detalle: ${detalleDelErr.message || detalleDelErr}` }, { status: 500 });
    }

    // Retornar la lista actualizada (para pintar sin recargar).
    const { data: detalleRows, error: detalleSelErr } = await insforge.database
      .from('gastos_fijos_semanales_detalle')
      .select('monto, gasto_fijo_catalogo_id')
      .eq('gastos_fijos_semanales_id', headerExisting.id);

    if (detalleSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando detalle: ${detalleSelErr.message}` }, { status: 500 });
    }

    const ids = (detalleRows ?? []).map((r: any) => r.gasto_fijo_catalogo_id).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, gastosGuardados: [] });
    }

    const { data: catalogRows, error: catalogRowsSelErr } = await insforge.database
      .from('gastos_fijos_catalogo')
      .select('id, nombre')
      .in('id', ids);

    if (catalogRowsSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando catalogo: ${catalogRowsSelErr.message}` }, { status: 500 });
    }

    const nombrePorId = new Map<string, string>();
    for (const row of catalogRows ?? []) {
      nombrePorId.set(row.id as string, row.nombre as string);
    }

    const gastosGuardados = (detalleRows ?? []).map((r: any) => ({
      nombre: nombrePorId.get(r.gasto_fijo_catalogo_id as string) ?? '',
      monto: Number(r.monto),
    }));

    return NextResponse.json({ success: true, gastosGuardados });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


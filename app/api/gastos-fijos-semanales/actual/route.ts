import { NextRequest, NextResponse } from 'next/server';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';

export const runtime = 'nodejs';

function getWeekStartISO(date: Date, timeZone = 'America/Mexico_City') {
  // Calcula el lunes (ISO-ish) de la semana según la zona horaria indicada.
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

export async function GET(_request: NextRequest) {
  try {
    assertInsforgeConfigured();

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
      return NextResponse.json({
        success: true,
        semanaFechaInicio,
        gastosGuardados: [],
      });
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
      return NextResponse.json({
        success: true,
        semanaFechaInicio,
        gastosGuardados: [],
      });
    }

    const { data: detalleRows, error: detalleSelErr } = await insforge.database
      .from('gastos_fijos_semanales_detalle')
      .select('monto, gasto_fijo_catalogo_id')
      .eq('gastos_fijos_semanales_id', headerExisting.id);

    if (detalleSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando detalle: ${detalleSelErr.message}` }, { status: 500 });
    }

    const ids = (detalleRows ?? []).map((r: any) => r.gasto_fijo_catalogo_id).filter(Boolean);
    const { data: catalogRows, error: catalogSelErr } = await insforge.database
      .from('gastos_fijos_catalogo')
      .select('id, nombre')
      .in('id', ids);

    if (catalogSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando catalogo: ${catalogSelErr.message}` }, { status: 500 });
    }

    const nombrePorId = new Map<string, string>();
    for (const row of catalogRows ?? []) {
      nombrePorId.set(row.id as string, row.nombre as string);
    }

    const gastosGuardados = (detalleRows ?? []).map((r: any) => ({
      nombre: nombrePorId.get(r.gasto_fijo_catalogo_id as string) ?? '',
      monto: Number(r.monto),
    }));

    return NextResponse.json({ success: true, semanaFechaInicio, gastosGuardados });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


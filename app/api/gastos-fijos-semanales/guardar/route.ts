import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';

export const runtime = 'nodejs';

const GastoSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  monto: z.number().nonnegative(),
});

const PayloadSchema = z.object({
  gastos: z.array(GastoSchema).min(1),
});

function getWeekStartISO(date: Date, timeZone = 'America/Mexico_City') {
  // Calcula el lunes de la semana (fecha_inicio) en zona horaria local.
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

  return localMidnightUTC.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function POST(request: NextRequest) {
  try {
    assertInsforgeConfigured();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'JSON inválido o malformado' }, { status: 400 });
    }

    const parsed = PayloadSchema.safeParse(body);
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

    // Normalización: consolidar por nombre (por si el usuario repite conceptos)
    const montoPorNombre = new Map<string, number>();
    for (const g of parsed.data.gastos) {
      const nombre = g.nombre.trim();
      const monto = Number(g.monto);
      montoPorNombre.set(nombre, (montoPorNombre.get(nombre) ?? 0) + monto);
    }

    const nombres = Array.from(montoPorNombre.keys());
    const semanaFechaInicio = getWeekStartISO(new Date());

    // 1) Semana (dimension)
    const { data: semanaExisting, error: semanaSelErr } = await insforge.database
      .from('semanas')
      .select('id')
      .eq('fecha_inicio', semanaFechaInicio)
      .maybeSingle();

    if (semanaSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando semanas: ${semanaSelErr.message}` }, { status: 500 });
    }

    let semanaId: string;
    if (semanaExisting?.id) {
      semanaId = semanaExisting.id as string;
    } else {
      const { data: semanaInserted, error: semanaInsErr } = await insforge.database
        .from('semanas')
        .insert({ fecha_inicio: semanaFechaInicio })
        .select('id')
        .single();

      if (semanaInsErr) {
        return NextResponse.json({ success: false, error: `Error insertando semana: ${semanaInsErr.message}` }, { status: 500 });
      }
      semanaId = semanaInserted!.id as string;
    }

    // 2) Header de gastos de la semana (1 registro por semana)
    const { data: headerExisting, error: headerSelErr } = await insforge.database
      .from('gastos_fijos_semanales')
      .select('id')
      .eq('semana_id', semanaId)
      .maybeSingle();

    if (headerSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando gastos_fijos_semanales: ${headerSelErr.message}` }, { status: 500 });
    }

    let headerId: string;
    if (headerExisting?.id) {
      headerId = headerExisting.id as string;
    } else {
      const { data: headerInserted, error: headerInsErr } = await insforge.database
        .from('gastos_fijos_semanales')
        .insert({ semana_id: semanaId })
        .select('id')
        .single();

      if (headerInsErr) {
        return NextResponse.json({ success: false, error: `Error insertando gastos_fijos_semanales: ${headerInsErr.message}` }, { status: 500 });
      }
      headerId = headerInserted!.id as string;
    }

    // 3) Catálogo de conceptos (gastos_fijos_catalogo)
    const { data: catalogRows, error: catalogSelErr } = await insforge.database
      .from('gastos_fijos_catalogo')
      .select('id, nombre')
      .in('nombre', nombres);

    if (catalogSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando catalogo: ${catalogSelErr.message}` }, { status: 500 });
    }

    const idPorNombre = new Map<string, string>();
    for (const row of catalogRows ?? []) {
      idPorNombre.set(row.nombre as string, row.id as string);
    }

    const nombresFaltantes = nombres.filter((n) => !idPorNombre.has(n));
    if (nombresFaltantes.length > 0) {
      const { data: insertedRows, error: catalogInsErr } = await insforge.database
        .from('gastos_fijos_catalogo')
        .insert(
          nombresFaltantes.map((nombre) => ({
            nombre,
            activo: true,
          }))
        )
        .select('id, nombre');

      if (catalogInsErr) {
        return NextResponse.json({ success: false, error: `Error insertando catalogo: ${catalogInsErr.message}` }, { status: 500 });
      }

      for (const row of insertedRows ?? []) {
        idPorNombre.set(row.nombre as string, row.id as string);
      }
    }

    // 4) Reemplazar detalle (delete + insert) para mantener consistencia
    const { error: detalleDelErr } = await insforge.database
      .from('gastos_fijos_semanales_detalle')
      .delete()
      .eq('gastos_fijos_semanales_id', headerId);

    if (detalleDelErr) {
      return NextResponse.json({ success: false, error: `Error limpiando detalle: ${detalleDelErr.message}` }, { status: 500 });
    }

    const detalleRows = nombres.map((nombre) => ({
      gastos_fijos_semanales_id: headerId,
      gasto_fijo_catalogo_id: idPorNombre.get(nombre)!,
      monto: montoPorNombre.get(nombre)!,
    }));

    const { error: detalleInsErr } = await insforge.database
      .from('gastos_fijos_semanales_detalle')
      .insert(detalleRows);

    if (detalleInsErr) {
      return NextResponse.json({ success: false, error: `Error insertando detalle: ${detalleInsErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      semanaFechaInicio,
      headerId,
      conceptos: detalleRows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


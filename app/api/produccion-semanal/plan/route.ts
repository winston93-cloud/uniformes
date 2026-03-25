import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';

export const runtime = 'nodejs';

function getWeekForDate(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // lunes
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const ItemSchema = z.object({
  cotizacion_id: z.string().min(1),
  cotizacion_folio: z.string().min(1),
  detalle_id: z.string().min(1),
  modelo: z.string().min(1),
  piezas: z.number().int().positive(),
  precio_unitario: z.number().nonnegative(),
  costo_unitario: z.number().nonnegative(),
});

const BodySchema = z.object({
  semanaOffset: z.number().int(),
  gastos_fijos_total: z.number().nonnegative(),
  ganancias_total: z.number(),
  estado: z.enum(['BORRADOR', 'GENERADO']).default('GENERADO'),
  items: z.array(ItemSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    assertInsforgeConfigured();

    const bodyRaw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(bodyRaw);
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

    const { semanaOffset, items, estado, gastos_fijos_total, ganancias_total } = parsed.data;

    const base = new Date();
    base.setDate(base.getDate() + semanaOffset * 7);
    const { monday, sunday } = getWeekForDate(base);
    const fecha_inicio = toISODate(monday);
    const fecha_fin = toISODate(sunday);

    // Semana (dimension)
    const { data: semanaExisting, error: semanaSelErr } = await insforge.database
      .from('semanas')
      .select('id')
      .eq('fecha_inicio', fecha_inicio)
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
        .insert({ fecha_inicio })
        .select('id')
        .single();
      if (semanaInsErr) {
        return NextResponse.json({ success: false, error: `Error insertando semana: ${semanaInsErr.message}` }, { status: 500 });
      }
      semanaId = semanaInserted!.id as string;
    }

    // Header plan (1 por semana). Si existe, lo sobreescribimos.
    const { data: planExisting, error: planSelErr } = await insforge.database
      .from('produccion_plan_semanal')
      .select('id')
      .eq('semana_id', semanaId)
      .maybeSingle();
    if (planSelErr) {
      return NextResponse.json({ success: false, error: `Error consultando plan: ${planSelErr.message}` }, { status: 500 });
    }

    let planId: string;
    if (planExisting?.id) {
      planId = planExisting.id as string;
      const { error: updErr } = await insforge.database
        .from('produccion_plan_semanal')
        .update({ fecha_inicio, fecha_fin, gastos_fijos_total, ganancias_total, estado })
        .eq('id', planId);
      if (updErr) {
        return NextResponse.json({ success: false, error: `Error actualizando plan: ${updErr.message}` }, { status: 500 });
      }
    } else {
      const { data: planInserted, error: planInsErr } = await insforge.database
        .from('produccion_plan_semanal')
        .insert({ semana_id: semanaId, fecha_inicio, fecha_fin, gastos_fijos_total, ganancias_total, estado })
        .select('id')
        .single();
      if (planInsErr) {
        return NextResponse.json({ success: false, error: `Error insertando plan: ${planInsErr.message}` }, { status: 500 });
      }
      planId = planInserted!.id as string;
    }

    // Reemplazar items (delete + insert)
    const { error: delErr } = await insforge.database
      .from('produccion_plan_semanal_items')
      .delete()
      .eq('plan_id', planId);
    if (delErr) {
      return NextResponse.json({ success: false, error: `Error limpiando items: ${delErr.message}` }, { status: 500 });
    }

    const rows = items.map((it) => {
      const ganancia_unitaria = Number((it.precio_unitario - it.costo_unitario).toFixed(2));
      const ganancia_total_item = Number((ganancia_unitaria * it.piezas).toFixed(2));
      return {
        plan_id: planId,
        cotizacion_id: it.cotizacion_id,
        cotizacion_folio: it.cotizacion_folio,
        detalle_id: it.detalle_id,
        modelo: it.modelo,
        piezas: it.piezas,
        precio_unitario: it.precio_unitario,
        costo_unitario: it.costo_unitario,
        ganancia_unitaria,
        ganancia_total: ganancia_total_item,
      };
    });

    const { error: insErr } = await insforge.database.from('produccion_plan_semanal_items').insert(rows);
    if (insErr) {
      return NextResponse.json({ success: false, error: `Error insertando items: ${insErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, planId, semanaId, fecha_inicio, fecha_fin, items: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


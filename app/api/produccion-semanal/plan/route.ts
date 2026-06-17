import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';
import { getWeekForDate, toISODate } from '@/lib/produccion-semanal-week';
import { getSupabaseErrorMessage } from '@/lib/supabase';

export const runtime = 'nodejs';

const ItemSchema = z.object({
  cotizacion_id: z.string().min(1),
  cotizacion_folio: z.string().min(1),
  detalle_id: z.string().min(1),
  modelo: z.string().min(1),
  piezas: z.number().int().positive(),
  precio_unitario: z.number().nonnegative(),
  costo_unitario: z.number().nonnegative(),
});

const BodySchema = z
  .object({
    semanaOffset: z.number().int(),
    gastos_fijos_total: z.number().nonnegative(),
    ganancias_total: z.number(),
    estado: z.enum(['BORRADOR', 'GENERADO']).default('GENERADO'),
    items: z.array(ItemSchema),
  })
  .superRefine((data, ctx) => {
    const ids = data.items.map((i) => i.detalle_id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'detalle_id duplicado en items' });
    }
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

    const detalleIds = [...new Set(items.map((it) => it.detalle_id).filter(Boolean))];

    /** Suma de piezas en otras semanas por partida (límite junto con esta semana = cantidad en cotización). */
    const { data: allPlansForSum, error: plansSumErr } = await insforge.database
      .from('produccion_plan_semanal')
      .select('id, fecha_inicio');
    if (plansSumErr) {
      return NextResponse.json({ success: false, error: `Error listando planes: ${plansSumErr.message}` }, { status: 500 });
    }
    const otherPlanIds = (allPlansForSum || [])
      .filter((p: { fecha_inicio: string }) => p.fecha_inicio !== fecha_inicio)
      .map((p: { id: string }) => p.id);

    const sumOtrasSemanas: Record<string, number> = {};
    if (otherPlanIds.length > 0 && detalleIds.length > 0) {
      const { data: otherItems, error: oiErr } = await insforge.database
        .from('produccion_plan_semanal_items')
        .select('detalle_id, piezas')
        .in('plan_id', otherPlanIds)
        .in('detalle_id', detalleIds);
      if (oiErr) {
        return NextResponse.json({ success: false, error: `Error leyendo otras semanas: ${oiErr.message}` }, { status: 500 });
      }
      for (const row of otherItems || []) {
        const r = row as { detalle_id: string; piezas?: number };
        const n = Number(r.piezas) || 0;
        if (n <= 0) continue;
        sumOtrasSemanas[r.detalle_id] = (sumOtrasSemanas[r.detalle_id] ?? 0) + n;
      }
    }

    if (detalleIds.length > 0) {
      const { data: detRows, error: detErr } = await insforge.database
        .from('detalle_cotizacion')
        .select('id, cantidad')
        .in('id', detalleIds);
      if (detErr) {
        return NextResponse.json(
          { success: false, error: `No se pudo validar partidas: ${getSupabaseErrorMessage(detErr)}` },
          { status: 500 }
        );
      }
      const cantidadPorId = new Map<string, number>();
      for (const row of detRows || []) {
        const r = row as { id: string; cantidad?: number };
        cantidadPorId.set(r.id, Math.max(0, Math.floor(Number(r.cantidad) || 0)));
      }
      for (const it of items) {
        const maxCant = cantidadPorId.get(it.detalle_id);
        if (maxCant === undefined) {
          return NextResponse.json(
            { success: false, error: `Partida no encontrada en cotización: ${it.detalle_id}` },
            { status: 400 }
          );
        }
        const otras = sumOtrasSemanas[it.detalle_id] ?? 0;
        if (it.piezas + otras > maxCant) {
          return NextResponse.json(
            {
              success: false,
              error: `Piezas de partida ${it.modelo}: máximo ${maxCant} en cotización; ${otras} ya en otras semanas; esta semana como mucho ${Math.max(0, maxCant - otras)}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const { error: delErr } = await insforge.database.from('produccion_plan_semanal_items').delete().eq('plan_id', planId);
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

    if (rows.length > 0) {
      const { error: insErr } = await insforge.database.from('produccion_plan_semanal_items').insert(rows);
      if (insErr) {
        return NextResponse.json({ success: false, error: `Error insertando items: ${insErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, planId, semanaId, fecha_inicio, fecha_fin, items: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

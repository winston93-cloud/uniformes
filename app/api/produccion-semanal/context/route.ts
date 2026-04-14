import { NextRequest, NextResponse } from 'next/server';
import { insforge, assertInsforgeConfigured } from '@/lib/insforge';
import { getWeekForDate, toISODate } from '@/lib/produccion-semanal-week';

export const runtime = 'nodejs';

/**
 * Contexto del modal de producción: semana vista + piezas ya asignadas en *otras* semanas
 * por partida + ítems guardados del plan de esta semana.
 */
export async function GET(request: NextRequest) {
  try {
    assertInsforgeConfigured();

    const semanaOffset = parseInt(request.nextUrl.searchParams.get('semanaOffset') || '0', 10);
    const base = new Date();
    base.setDate(base.getDate() + semanaOffset * 7);
    const { monday, sunday } = getWeekForDate(base);
    const fecha_inicio = toISODate(monday);
    const fecha_fin = toISODate(sunday);

    const { data: allPlans, error: planErr } = await insforge.database
      .from('produccion_plan_semanal')
      .select('id, fecha_inicio, fecha_fin, estado');

    if (planErr) {
      return NextResponse.json({ success: false, error: planErr.message }, { status: 500 });
    }

    const { data: allItems, error: itemsErr } = await insforge.database
      .from('produccion_plan_semanal_items')
      .select('detalle_id, plan_id, piezas');

    if (itemsErr) {
      return NextResponse.json({ success: false, error: itemsErr.message }, { status: 500 });
    }

    const planFecha = new Map<string, string>();
    for (const p of allPlans || []) {
      const row = p as { id: string; fecha_inicio: string };
      planFecha.set(row.id, row.fecha_inicio);
    }

    /** Suma de piezas por detalle_id en planes cuya semana NO es la que se está editando. */
    const piezasEnOtrasSemanas: Record<string, number> = {};
    for (const it of allItems || []) {
      const row = it as { detalle_id: string; plan_id: string; piezas?: number };
      const fi = planFecha.get(row.plan_id);
      if (!fi || fi === fecha_inicio) continue;
      const n = Number(row.piezas) || 0;
      if (n <= 0) continue;
      piezasEnOtrasSemanas[row.detalle_id] = (piezasEnOtrasSemanas[row.detalle_id] ?? 0) + n;
    }

    const planSem = (allPlans || []).find((p: any) => p.fecha_inicio === fecha_inicio);
    let planItems: unknown[] = [];
    if (planSem) {
      const { data: items, error: itErr } = await insforge.database
        .from('produccion_plan_semanal_items')
        .select('*')
        .eq('plan_id', (planSem as { id: string }).id);
      if (itErr) {
        return NextResponse.json({ success: false, error: itErr.message }, { status: 500 });
      }
      planItems = items || [];
    }

    return NextResponse.json({
      success: true,
      fecha_inicio,
      fecha_fin,
      /** @deprecated Preferir piezasEnOtrasSemanas; se mantiene vacío por compatibilidad. */
      ocupados: {} as Record<string, string>,
      piezasEnOtrasSemanas,
      planItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

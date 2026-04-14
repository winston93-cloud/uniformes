/** Misma lógica que en `app/api/produccion-semanal/plan/route.ts` (lunes = inicio de semana). */
export function getWeekForDate(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function weekBoundsFromOffset(semanaOffset: number) {
  const base = new Date();
  base.setDate(base.getDate() + semanaOffset * 7);
  const { monday, sunday } = getWeekForDate(base);
  return { fecha_inicio: toISODate(monday), fecha_fin: toISODate(sunday), monday, sunday };
}

export function stripTimeLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parsea YYYY-MM-DD en fecha local (evita desfase UTC). */
export function parseISODateToLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (!y || mo < 0 || mo > 11 || day < 1 || day > 31) return null;
  return new Date(y, mo, day);
}

/**
 * Prioridad para la regla de “Editar selección”: entrega en la semana del plan (planMonday)
 * o en la inmediata siguiente. Sin fecha de entrega se trata como prioritaria.
 * Fechas anteriores al plan también entran (entregas ya cercanas/vencidas).
 */
export function cotizacionPrioritariaParaPlan(
  fecha_entrega: string | null | undefined,
  planMonday: Date
): boolean {
  if (!fecha_entrega) return true;
  const d = parseISODateToLocal(fecha_entrega);
  if (!d) return true;
  const planMon = stripTimeLocal(planMonday);
  const finVentana = new Date(planMon);
  finVentana.setDate(planMon.getDate() + 13); // domingo de la 2.ª semana vista desde planMonday
  const ds = stripTimeLocal(d);
  const fe = stripTimeLocal(finVentana);
  return ds.getTime() <= fe.getTime();
}

/** Último día (domingo) de la “ventana de prioridad” respecto al lunes del plan. */
export function finVentanaPrioridadPlan(planMonday: Date): Date {
  const planMon = stripTimeLocal(planMonday);
  const fin = new Date(planMon);
  fin.setDate(planMon.getDate() + 13);
  return fin;
}
